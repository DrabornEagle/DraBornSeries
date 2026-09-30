-- Add R2 without replacing any existing catalog record or media source.
alter table drabornseries.dbs_video_assets drop constraint dbs_video_assets_provider_check;
alter table drabornseries.dbs_video_assets add constraint dbs_video_assets_provider_check check(provider in ('cloudflare','demo','r2'));
alter table drabornseries.dbs_video_assets add constraint dbs_r2_key_required check(provider<>'r2' or nullif(btrim(r2_key),'') is not null);
alter table drabornseries.dbs_series add column video_orientation text check(video_orientation in ('portrait','landscape'));
alter table drabornseries.dbs_series add column r2_folder text;
alter table drabornseries.dbs_series add column r2_trailer_key text;
alter table drabornseries.dbs_profiles drop constraint dbs_profiles_username_check;
alter table drabornseries.dbs_profiles add constraint dbs_profiles_username_check check(length(username) between 3 and 320);

create function dbs_series_private.dbs_series_direction() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.video_orientation is not null then
    update drabornseries.dbs_episodes set orientation=new.video_orientation where series_id=new.id and orientation is distinct from new.video_orientation;
  end if;
  return new;
end $$;
revoke all on function dbs_series_private.dbs_series_direction() from public,anon,authenticated;
create trigger dbs_series_direction after update of video_orientation on drabornseries.dbs_series
for each row execute function dbs_series_private.dbs_series_direction();

create function dbs_series_private.dbs_episode_direction() returns trigger
language plpgsql security definer set search_path='' as $$
declare chosen text;
begin
  select video_orientation into chosen from drabornseries.dbs_series where id=new.series_id;
  if chosen is not null then new.orientation:=chosen; end if;
  return new;
end $$;
revoke all on function dbs_series_private.dbs_episode_direction() from public,anon,authenticated;
create trigger dbs_episode_direction before insert or update of series_id,orientation on drabornseries.dbs_episodes
for each row execute function dbs_series_private.dbs_episode_direction();

-- Google metadata supplies presentation fields only, never a role/permission.
create or replace function dbs_series_private.dbs_bootstrap(device text,label text,platform text) returns void
language plpgsql security definer set search_path='' as $$
declare registration jsonb; metadata jsonb; account_email text; chosen_username text; chosen_name text; photo text; google_account boolean;
begin
  if auth.uid() is null or length(device)>100 or length(label)>100 then raise exception 'AUTH_REQUIRED'; end if;
  select raw_user_meta_data,email into metadata,account_email from auth.users where id=auth.uid();
  select exists(select 1 from auth.identities where user_id=auth.uid() and provider='google') into google_account;
  registration:=metadata->'dbs_registration';
  chosen_username:=case when google_account then nullif(btrim(account_email),'') else nullif(btrim(left(registration->>'username',320)),'') end;
  if chosen_username is null or length(chosen_username)<3 then chosen_username:='viewer_'||replace(auth.uid()::text,'-',''); end if;
  chosen_name:=nullif(btrim(left(coalesce(registration->>'full_name',metadata->>'full_name',metadata->>'name'),80)),'');
  photo:=coalesce(metadata->>'avatar_url',metadata->>'picture');
  if not google_account or photo !~ '^https://([a-zA-Z0-9-]+\.)*googleusercontent\.com/' then photo:=null; end if;
  begin
    insert into drabornseries.dbs_profiles(user_id,username,full_name,avatar_url,preferences)
      values(auth.uid(),chosen_username,chosen_name,photo,case when google_account then '{"google_profile_imported":true}'::jsonb else '{}'::jsonb end)
      on conflict(user_id) do nothing;
  exception when unique_violation then
    insert into drabornseries.dbs_profiles(user_id,username,full_name,avatar_url)
      values(auth.uid(),'viewer_'||replace(auth.uid()::text,'-',''),chosen_name,photo) on conflict(user_id) do nothing;
  end;
  if google_account then
    update drabornseries.dbs_profiles p set
      username=case when p.username='viewer_'||replace(auth.uid()::text,'-','') and not exists(select 1 from drabornseries.dbs_profiles other where other.username=chosen_username and other.user_id<>auth.uid()) then chosen_username else p.username end,
      full_name=coalesce(nullif(p.full_name,''),chosen_name),
      avatar_url=case when coalesce(p.preferences->>'google_profile_imported','false')<>'true' then coalesce(nullif(p.avatar_url,''),photo) else p.avatar_url end,
      preferences=p.preferences||'{"google_profile_imported":true}'::jsonb
      where user_id=auth.uid();
  end if;
  if not dbs_series_private.dbs_active() then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  insert into drabornseries.dbs_borncoins_wallet(user_id) values(auth.uid()) on conflict do nothing;
  insert into drabornseries.dbs_user_streaks(user_id) values(auth.uid()) on conflict do nothing;
  insert into drabornseries.dbs_devices(user_id,device_id,label,platform) values(auth.uid(),device,label,platform)
    on conflict(user_id,device_id) do update set last_seen_at=now(),label=excluded.label;
  insert into drabornseries.dbs_user_sessions(user_id,session_id,device_id) values(auth.uid(),(auth.jwt()->>'session_id')::uuid,device)
    on conflict(user_id,session_id) do update set last_seen_at=now();
end $$;

-- A Worker may resolve only a currently published free or entitled episode.
grant usage on schema dbs_series_private to anon;
create function dbs_series_private.dbs_r2_playback_key(episode uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
  select a.r2_key into result from drabornseries.dbs_video_assets a
    join drabornseries.dbs_episodes e on e.id=a.episode_id join drabornseries.dbs_series s on s.id=e.series_id
    where e.id=episode and a.provider='r2' and a.ready and s.status='published' and e.status='published' and e.publish_at<=now()
      and (e.access_type='free' or (auth.uid() is not null and dbs_series_private.dbs_access(episode)));
  if result is null then raise exception 'ACCESS_DENIED'; end if;
  return result;
end $$;
revoke all on function dbs_series_private.dbs_r2_playback_key(uuid) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_r2_playback_key(uuid) to anon,authenticated;
create function drabornseries.dbs_r2_playback_key(episode uuid) returns text language sql stable security invoker set search_path='' as $$
  select dbs_series_private.dbs_r2_playback_key(episode)
$$;
revoke all on function drabornseries.dbs_r2_playback_key(uuid) from public,anon,authenticated;
grant execute on function drabornseries.dbs_r2_playback_key(uuid) to anon,authenticated;

create function dbs_series_private.dbs_r2_trailer_key(series uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
  select r2_trailer_key into result from drabornseries.dbs_series where id=series and status='published';
  if result is null then raise exception 'ACCESS_DENIED'; end if;
  return result;
end $$;
revoke all on function dbs_series_private.dbs_r2_trailer_key(uuid) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_r2_trailer_key(uuid) to anon,authenticated;
create function drabornseries.dbs_r2_trailer_key(series uuid) returns text language sql stable security invoker set search_path='' as $$
  select dbs_series_private.dbs_r2_trailer_key(series)
$$;
revoke all on function drabornseries.dbs_r2_trailer_key(uuid) from public,anon,authenticated;
grant execute on function drabornseries.dbs_r2_trailer_key(uuid) to anon,authenticated;

-- The API validates R2 objects before this one atomic content transaction.
create function drabornseries.dbs_studio_save_series(actor uuid,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare info jsonb:=payload->'series'; item jsonb; target uuid; existing drabornseries.dbs_series; episode_row drabornseries.dbs_episodes; selected_episode uuid; selected_season uuid; old_key text; episode_count integer;
begin
  if not exists(select 1 from drabornseries.dbs_admin_users a join drabornseries.dbs_profiles p on p.user_id=a.user_id where a.user_id=actor and a.role in ('owner','editor') and p.status='active') then raise exception 'EDITOR_REQUIRED'; end if;
  if jsonb_typeof(info)<>'object' or length(btrim(coalesce(info->>'title','')))<1 or coalesce(info->>'video_orientation','') not in ('portrait','landscape') or coalesce(info->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'INVALID_SERIES'; end if;
  if jsonb_array_length(coalesce(payload->'episodes','[]'))>50 then raise exception 'TOO_MANY_EPISODES'; end if;
  target:=nullif(info->>'id','')::uuid;
  if target is null then
    insert into drabornseries.dbs_series(slug,title) values(info->>'slug',btrim(info->>'title')) returning id into target;
  else
    select * into existing from drabornseries.dbs_series where id=target for update;
    if existing.id is null then raise exception 'SERIES_NOT_FOUND'; end if;
  end if;
  update drabornseries.dbs_series set title=btrim(info->>'title'),slug=info->>'slug',
    short_description=coalesce(info->>'short_description',short_description),description=coalesce(info->>'description',description),
    poster_url=case when info ? 'poster_url' then nullif(info->>'poster_url','') else poster_url end,
    banner_url=case when info ? 'banner_url' then nullif(info->>'banner_url','') else banner_url end,
    trailer_url=case when info ? 'trailer_url' then nullif(info->>'trailer_url','') else trailer_url end,
    r2_trailer_key=case when info ? 'r2_trailer_key' then nullif(info->>'r2_trailer_key','') else r2_trailer_key end,
    genres=case when info ? 'genres' then array(select jsonb_array_elements_text(info->'genres')) else genres end,
    status=coalesce(info->>'status',status),is_vip=coalesce((info->>'is_vip')::boolean,is_vip),
    video_orientation=info->>'video_orientation',r2_folder=coalesce(info->>'r2_folder',r2_folder),
    featured_order=case when info ? 'featured_order' then nullif(info->>'featured_order','')::integer else featured_order end
    where id=target;
  update drabornseries.dbs_series set alternative_title=coalesce(info->>'alternative_title',alternative_title),
    director=coalesce(info->>'director',director),production_year=coalesce(nullif(info->>'production_year','')::integer,production_year),
    country=coalesce(info->>'country',country),age_rating=coalesce(info->>'age_rating',age_rating),
    cast_names=case when info ? 'cast_names' then array(select jsonb_array_elements_text(info->'cast_names')) else cast_names end,
    release_at=case when info ? 'release_at' then nullif(info->>'release_at','')::timestamptz else release_at end where id=target;
  for item in select value from jsonb_array_elements(coalesce(payload->'episodes','[]')) loop
    selected_episode:=nullif(item->>'id','')::uuid;
    episode_row:=null;
    if selected_episode is not null then
      select * into episode_row from drabornseries.dbs_episodes where id=selected_episode and series_id=target for update;
      if episode_row.id is null then raise exception 'INVALID_EPISODE'; end if;
    else
      select * into episode_row from drabornseries.dbs_episodes where series_id=target and number=(item->>'number')::integer for update;
      if episode_row.id is not null then
        select r2_key into old_key from drabornseries.dbs_video_assets where dbs_video_assets.episode_id=episode_row.id;
        if old_key is distinct from nullif(item->>'r2_key','') then raise exception 'DUPLICATE_EPISODE'; end if;
        selected_episode:=episode_row.id;
      end if;
    end if;
    insert into drabornseries.dbs_seasons(series_id,number,title) values(target,coalesce((item->>'season_number')::integer,1),'Sezon '||coalesce((item->>'season_number')::integer,1))
      on conflict(series_id,number) do update set number=excluded.number returning id into selected_season;
    if selected_episode is null then
      insert into drabornseries.dbs_episodes(series_id,season_id,number,title) values(target,selected_season,(item->>'number')::integer,coalesce(nullif(item->>'title',''),'Bölüm '||(item->>'number'))) returning id into selected_episode;
    end if;
    update drabornseries.dbs_episodes set season_id=selected_season,number=coalesce((item->>'number')::integer,number),title=coalesce(nullif(item->>'title',''),title),
      description=coalesce(item->>'description',description),duration_seconds=coalesce(nullif(item->>'duration_seconds','')::integer,duration_seconds),
      access_type=coalesce(item->>'access_type',access_type),coin_price=coalesce((item->>'coin_price')::integer,coin_price),
      vip_included=coalesce((item->>'vip_included')::boolean,vip_included),status=coalesce(item->>'status',status),
      publish_at=coalesce(nullif(item->>'publish_at','')::timestamptz,publish_at)
      where id=selected_episode;
    if nullif(item->>'r2_key','') is not null then
      insert into drabornseries.dbs_video_assets(episode_id,provider,r2_key,ready)
        values(selected_episode,'r2',item->>'r2_key',true) on conflict on constraint dbs_video_assets_episode_id_key do update
        set provider='r2',r2_key=excluded.r2_key,stream_uid=null,demo_url=null,renditions='[]',ready=true;
    end if;
  end loop;
  select count(*) into episode_count from drabornseries.dbs_episodes where series_id=target;
  update drabornseries.dbs_series set total_episodes=episode_count,
    total_seasons=(select count(*) from drabornseries.dbs_seasons where series_id=target),
    average_duration=coalesce((select avg(duration_seconds)::integer from drabornseries.dbs_episodes where series_id=target),120) where id=target;
  insert into drabornseries.dbs_admin_logs(admin_id,action,target,detail) values(actor,'save','dbs_series',jsonb_build_object('id',target,'episodes',jsonb_array_length(coalesce(payload->'episodes','[]')),'provider','r2'));
  return jsonb_build_object('id',target,'episodes',episode_count);
end $$;
revoke all on function drabornseries.dbs_studio_save_series(uuid,jsonb) from public,anon,authenticated;
grant execute on function drabornseries.dbs_studio_save_series(uuid,jsonb) to service_role;
