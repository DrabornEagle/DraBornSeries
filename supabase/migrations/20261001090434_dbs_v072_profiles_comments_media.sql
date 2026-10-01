-- Generated Google names use only the local part; manually chosen names remain.
alter table drabornseries.dbs_profiles drop constraint dbs_profiles_username_check;
alter table drabornseries.dbs_profiles add constraint dbs_profiles_username_check check(length(username) between 1 and 320);
create or replace function dbs_series_private.dbs_bootstrap(device text,label text,platform text) returns void
language plpgsql security definer set search_path='' as $$
declare registration jsonb; metadata jsonb; account_email text; chosen_username text; chosen_name text; photo text; google_account boolean;
begin
  if auth.uid() is null or length(device)>100 or length(label)>100 then raise exception 'AUTH_REQUIRED'; end if;
  select raw_user_meta_data,email into metadata,account_email from auth.users where id=auth.uid();
  select exists(select 1 from auth.identities where user_id=auth.uid() and provider='google') into google_account;
  registration:=metadata->'dbs_registration';
  chosen_username:=case when google_account then nullif(btrim(split_part(account_email,'@',1)),'') else nullif(btrim(left(registration->>'username',320)),'') end;
  if chosen_username is null or (not google_account and length(chosen_username)<3) then chosen_username:='viewer_'||replace(auth.uid()::text,'-',''); end if;
  if google_account and exists(select 1 from drabornseries.dbs_profiles where username=chosen_username and user_id<>auth.uid()) then chosen_username:=chosen_username||'_'||left(replace(auth.uid()::text,'-',''),8); end if;
  chosen_name:=nullif(btrim(left(coalesce(registration->>'full_name',metadata->>'full_name',metadata->>'name'),80)),'');
  photo:=coalesce(metadata->>'avatar_url',metadata->>'picture');
  if not google_account or photo !~ '^https://([a-zA-Z0-9-]+\.)*googleusercontent\.com/' then photo:=null; end if;
  begin
    insert into drabornseries.dbs_profiles(user_id,username,full_name,avatar_url,preferences)
      values(auth.uid(),chosen_username,chosen_name,photo,case when google_account then '{"google_profile_imported":true}'::jsonb else '{}'::jsonb end)
      on conflict(user_id) do nothing;
  exception when unique_violation then
    insert into drabornseries.dbs_profiles(user_id,username,full_name,avatar_url)
      values(auth.uid(),case when google_account then split_part(account_email,'@',1)||'_'||replace(auth.uid()::text,'-','') else 'viewer_'||replace(auth.uid()::text,'-','') end,chosen_name,photo) on conflict(user_id) do nothing;
  end;
  if google_account then
    update drabornseries.dbs_profiles p set
      username=case when (p.username=account_email or p.username='viewer_'||replace(auth.uid()::text,'-','')) and not exists(select 1 from drabornseries.dbs_profiles other where other.username=chosen_username and other.user_id<>auth.uid()) then chosen_username else p.username end,
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


do $$
declare item record; candidate text;
begin
 for item in select p.user_id,p.username,u.email from drabornseries.dbs_profiles p join auth.users u on u.id=p.user_id
   where p.status='active' and exists(select 1 from auth.identities where user_id=p.user_id and provider='google')
     and (p.username=u.email or p.username='viewer_'||replace(p.user_id::text,'-','')) order by p.created_at,p.user_id loop
   candidate:=split_part(item.email,'@',1);
   if length(candidate)=0 then continue; end if;
   if exists(select 1 from drabornseries.dbs_profiles where username=candidate and user_id<>item.user_id) then candidate:=candidate||'_'||left(replace(item.user_id::text,'-',''),8); end if;
   begin update drabornseries.dbs_profiles set username=candidate where user_id=item.user_id;
   exception when unique_violation then update drabornseries.dbs_profiles set username=split_part(item.email,'@',1)||'_'||replace(item.user_id::text,'-','') where user_id=item.user_id; end;
 end loop;
end $$;

-- Immediate publication retains the original rate/duplicate guards and hide controls.
alter table drabornseries.dbs_comments alter column status set default 'published';
drop policy dbs_comment_insert on drabornseries.dbs_comments;
create policy dbs_comment_insert on drabornseries.dbs_comments for insert to authenticated
 with check(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()) and status='published');
-- Ready counterparts can be added without removing portrait sources or episode IDs.
alter table drabornseries.dbs_video_assets add column landscape_renditions jsonb not null default '[]'::jsonb check(jsonb_typeof(landscape_renditions)='array');
notify pgrst,'reload schema';
