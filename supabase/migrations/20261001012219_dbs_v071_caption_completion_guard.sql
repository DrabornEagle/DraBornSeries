-- Preserve manual Turkish overrides, including one inserted while a runner completes.
create function dbs_series_private.dbs_is_turkish(language text) returns boolean
language sql immutable parallel safe set search_path='' as $$
  select split_part(lower(replace(language,'_','-')),'-',1) in ('tr','tur') or lower(language) in ('turkish','türkçe')
$$;
revoke all on function dbs_series_private.dbs_is_turkish(text) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_is_turkish(text) to service_role;
create function dbs_series_private.dbs_manual_caption_override() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if dbs_series_private.dbs_is_turkish(new.language) and new.asset_key not like 'dbs-auto/%' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.episode_id::text,0));
    delete from drabornseries.dbs_subtitles where episode_id=new.episode_id and asset_key like 'dbs-auto/%' and id is distinct from new.id;
  end if;
  return new;
end $$;
revoke all on function dbs_series_private.dbs_manual_caption_override() from public,anon,authenticated;
create trigger dbs_manual_caption_override before insert or update on drabornseries.dbs_subtitles
  for each row execute function dbs_series_private.dbs_manual_caption_override();
create or replace function dbs_series_private.dbs_queue_caption() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.provider='r2' and new.r2_key is not null and not exists(select 1 from drabornseries.dbs_subtitles s
    where s.episode_id=new.episode_id and dbs_series_private.dbs_is_turkish(s.language) and s.asset_key not like 'dbs-auto/%') then
    insert into drabornseries.dbs_auto_subtitle_jobs(episode_id,source_key) values(new.episode_id,new.r2_key) on conflict do nothing;
  end if;
  return new;
end $$;
create or replace function drabornseries.dbs_finish_caption(job_id uuid,lease uuid,outcome text,language text,cause text default null,actual_duration integer default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job drabornseries.dbs_auto_subtitle_jobs; current_key text;
begin
  if auth.role()<>'service_role' then raise exception 'ACCESS_DENIED'; end if;
  if outcome not in ('completed','no_speech','failed') then raise exception 'INVALID_CAPTION'; end if;
  select * into job from drabornseries.dbs_auto_subtitle_jobs where id=job_id;
  if job.id is null then raise exception 'CAPTION_LEASE_EXPIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(job.episode_id::text,0));
  select * into job from drabornseries.dbs_auto_subtitle_jobs where id=job_id for update;
  if job.id is null or job.status<>'processing' or job.lease_id is distinct from lease or job.lease_until<now() then raise exception 'CAPTION_LEASE_EXPIRED'; end if;
  select r2_key into current_key from drabornseries.dbs_video_assets where episode_id=job.episode_id and provider='r2' for update;
  if current_key is distinct from job.source_key then outcome:='superseded';
  elsif exists(select 1 from drabornseries.dbs_subtitles s where s.episode_id=job.episode_id and dbs_series_private.dbs_is_turkish(s.language) and s.asset_key not like 'dbs-auto/%') then outcome:='manual';
  elsif outcome='completed' then
    delete from drabornseries.dbs_subtitles where episode_id=job.episode_id and asset_key like 'dbs-auto/%';
    insert into drabornseries.dbs_subtitles(episode_id,language,label,asset_key)
      values(job.episode_id,'tr','Türkçe · Otomatik','dbs-auto/'||job.episode_id||'/'||job.id||'.vtt');
  end if;
  if outcome in ('completed','no_speech') and actual_duration between 1 and 7200 then
    update drabornseries.dbs_episodes set duration_seconds=actual_duration where id=job.episode_id and duration_seconds<>actual_duration;
  end if;
  update drabornseries.dbs_auto_subtitle_jobs set status=outcome,detected_language=left(language,20),error=left(cause,200),lease_id=null,lease_until=null,updated_at=now() where id=job.id;
  return jsonb_build_object('status',outcome,'episode',job.episode_id);
end $$;
