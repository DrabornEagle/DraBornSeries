-- Only DraBornSeries schema and its dedicated Storage bucket are changed.
alter table drabornseries.dbs_series add column source_credit jsonb not null default '{}'::jsonb check(jsonb_typeof(source_credit)='object');
alter table drabornseries.dbs_video_assets add column renditions jsonb not null default '[]'::jsonb
  check(jsonb_typeof(renditions)='array');

create function dbs_series_private.dbs_media_editor() returns boolean
language sql stable security definer set search_path='' as $$
 select dbs_series_private.dbs_active() and exists(
   select 1 from drabornseries.dbs_admin_users
   where user_id=(select auth.uid()) and role in ('owner','editor'))
$$;
revoke all on function dbs_series_private.dbs_media_editor() from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_media_editor() to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dbs_series_artwork','dbs_series_artwork',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy dbs_artwork_read on storage.objects for select to anon,authenticated
using(bucket_id='dbs_series_artwork');
create policy dbs_artwork_insert on storage.objects for insert to authenticated
with check(bucket_id='dbs_series_artwork' and (storage.foldername(name))[1]=(select auth.uid())::text
  and (select dbs_series_private.dbs_media_editor()));
create policy dbs_artwork_update on storage.objects for update to authenticated
using(bucket_id='dbs_series_artwork' and (storage.foldername(name))[1]=(select auth.uid())::text and (select dbs_series_private.dbs_media_editor()))
with check(bucket_id='dbs_series_artwork' and (storage.foldername(name))[1]=(select auth.uid())::text and (select dbs_series_private.dbs_media_editor()));
create policy dbs_artwork_delete on storage.objects for delete to authenticated
using(bucket_id='dbs_series_artwork' and (storage.foldername(name))[1]=(select auth.uid())::text and (select dbs_series_private.dbs_media_editor()));

-- Editable Auth metadata is used solely for optional display fields, never authorization.
-- It is read on first profile creation only, so later profile edits remain intact.
create or replace function dbs_series_private.dbs_bootstrap(device text, label text, platform text)
returns void language plpgsql security definer set search_path='' as $$
declare registration jsonb; chosen_username text; chosen_name text;
begin
 if auth.uid() is null or length(device)>100 or length(label)>100 then raise exception 'AUTH_REQUIRED'; end if;
 select raw_user_meta_data->'dbs_registration' into registration from auth.users where id=auth.uid();
 chosen_username:=nullif(btrim(left(registration->>'username',40)),'');
 if chosen_username is null or length(chosen_username)<3 then chosen_username:='viewer_'||replace(auth.uid()::text,'-',''); end if;
 chosen_name:=nullif(btrim(left(registration->>'full_name',80)),'');
 begin
   insert into drabornseries.dbs_profiles(user_id,username,full_name) values(auth.uid(),chosen_username,chosen_name) on conflict(user_id) do nothing;
 exception when unique_violation then
   insert into drabornseries.dbs_profiles(user_id,username,full_name)
   values(auth.uid(),'viewer_'||replace(auth.uid()::text,'-',''),chosen_name) on conflict(user_id) do nothing;
 end;
 if not dbs_series_private.dbs_active() then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 insert into drabornseries.dbs_borncoins_wallet(user_id) values(auth.uid()) on conflict do nothing;
 insert into drabornseries.dbs_user_streaks(user_id) values(auth.uid()) on conflict do nothing;
 insert into drabornseries.dbs_devices(user_id,device_id,label,platform) values(auth.uid(),device,label,platform)
 on conflict(user_id,device_id) do update set last_seen_at=now(),label=excluded.label;
 insert into drabornseries.dbs_user_sessions(user_id,session_id,device_id) values(auth.uid(),(auth.jwt()->>'session_id')::uuid,device)
 on conflict(user_id,session_id) do update set last_seen_at=now();
end $$;
