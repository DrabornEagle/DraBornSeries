-- Only the DraBornSeries schema is changed. Credentials never enter this table.
create table drabornseries.dbs_video_uploads (
  uid text primary key check(uid ~ '^[a-f0-9]{32}$'),
  episode_id uuid references drabornseries.dbs_episodes(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  purpose text not null check(purpose in ('episode','trailer')),
  status text not null default 'pending' check(status in ('pending','processing','ready','error','superseded')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(purpose <> 'episode' or episode_id is not null)
);
alter table drabornseries.dbs_video_uploads enable row level security;
revoke all on drabornseries.dbs_video_uploads from public,anon,authenticated;
grant all on drabornseries.dbs_video_uploads to service_role;
create index dbs_video_uploads_pending on drabornseries.dbs_video_uploads(status,updated_at);
create index dbs_video_uploads_episode on drabornseries.dbs_video_uploads(episode_id,created_at);
create index dbs_video_uploads_creator on drabornseries.dbs_video_uploads(created_by);

-- Atomically bind the UID after encoding. A failed replacement keeps the old
-- playable asset. An older callback cannot overwrite a newer selected upload.
create function drabornseries.dbs_complete_stream_upload(upload_uid text, details jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare upload drabornseries.dbs_video_uploads; duration integer;
begin
  select * into upload from drabornseries.dbs_video_uploads where uid=upload_uid for update;
  if not found then return false; end if;
  if details->>'uid' is distinct from upload_uid then raise exception 'INVALID_STREAM_UID'; end if;
  if upload.status in ('ready','superseded') then return upload.status='ready'; end if;
  if details->'status'->>'state'='error' then
    update drabornseries.dbs_video_uploads set status='error',error_code=left(coalesce(nullif(details->'status'->>'errorReasonCode',''),details->'status'->>'errReasonCode','STREAM_ENCODING_FAILED'),100),updated_at=now() where uid=upload_uid;
    return false;
  end if;
  if coalesce((details->>'readyToStream')::boolean,false) is not true then
    update drabornseries.dbs_video_uploads set status='processing',updated_at=now() where uid=upload_uid;
    return false;
  end if;
  if upload.purpose='episode' then
    perform 1 from drabornseries.dbs_episodes where id=upload.episode_id for update;
    if exists(select 1 from drabornseries.dbs_video_uploads newer where newer.episode_id=upload.episode_id and newer.created_at>upload.created_at and newer.status in ('processing','ready')) then
      update drabornseries.dbs_video_uploads set status='superseded',updated_at=now() where uid=upload_uid;
      return false;
    end if;
    if coalesce((details->>'requireSignedURLs')::boolean,false) is not true then raise exception 'VIDEO_MUST_REQUIRE_SIGNED_URLS'; end if;
    insert into drabornseries.dbs_video_assets(episode_id,provider,stream_uid,ready)
    values(upload.episode_id,'cloudflare',upload_uid,true)
    on conflict(episode_id) do update set provider=excluded.provider,stream_uid=excluded.stream_uid,ready=true,demo_url=null,renditions='[]'::jsonb;
    duration:=greatest(1,ceil(coalesce((details->>'duration')::numeric,1))::integer);
    update drabornseries.dbs_episodes set duration_seconds=duration where id=upload.episode_id;
    -- Keep the author's selected portrait/landscape direction.
  end if;
  update drabornseries.dbs_video_uploads set status='ready',error_code=null,updated_at=now() where uid=upload_uid;
  return true;
end $$;
revoke all on function drabornseries.dbs_complete_stream_upload(text,jsonb) from public,anon,authenticated;
grant execute on function drabornseries.dbs_complete_stream_upload(text,jsonb) to service_role;

update drabornseries.dbs_app_settings set value='{"version":"0.5.0","versionCode":1,"stage":"expo_go_test"}'::jsonb where key='release';
