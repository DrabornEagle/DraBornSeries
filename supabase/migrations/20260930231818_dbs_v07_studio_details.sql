-- Keep the previous metadata fields available in the combined series editor.
create or replace function drabornseries.dbs_studio_save_series(actor uuid,payload jsonb) returns jsonb
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
    tags=case when info ? 'tags' then array(select jsonb_array_elements_text(info->'tags')) else tags end,
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
      description=coalesce(item->>'description',description),
      thumbnail_url=case when item ? 'thumbnail_url' then nullif(item->>'thumbnail_url','') else thumbnail_url end,
      duration_seconds=coalesce(nullif(item->>'duration_seconds','')::integer,duration_seconds),
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
