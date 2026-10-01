-- DraBornSeries only. Existing catalogue rows and manually supplied captions are preserved.
alter table drabornseries.dbs_promo_codes drop constraint dbs_promo_codes_coins_check;
alter table drabornseries.dbs_promo_codes add column vip_days integer not null default 0;
alter table drabornseries.dbs_promo_codes add constraint dbs_promo_rewards_check
  check(coins between 0 and 1000000 and vip_days between 0 and 3650 and (coins>0 or vip_days>0));
alter table drabornseries.dbs_promo_codes add constraint dbs_promo_limits_check check(max_uses between 1 and 1000000 and uses>=0);
alter table drabornseries.dbs_promo_redemptions add column coins integer, add column vip_days integer, add column vip_until timestamptz;

create function dbs_series_private.dbs_redeem_reward(code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare promo drabornseries.dbs_promo_codes; vip_end timestamptz;
begin
  if not dbs_series_private.dbs_active() then raise exception 'AUTH_REQUIRED'; end if;
  -- Serialize different codes for the same account before extending the VIP period.
  perform 1 from drabornseries.dbs_profiles where user_id=auth.uid() for update;
  select * into promo from drabornseries.dbs_promo_codes p
    where p.code=upper(trim(dbs_redeem_reward.code)) and p.active and p.expires_at>now() for update;
  if promo.id is null or promo.uses>=promo.max_uses then raise exception 'INVALID_PROMO'; end if;
  if exists(select 1 from drabornseries.dbs_promo_redemptions where user_id=auth.uid() and promo_id=promo.id) then raise exception 'ALREADY_CLAIMED'; end if;
  if promo.coins>0 then
    perform dbs_series_private.dbs_ledger(auth.uid(),promo.coins,'promotion','promo:'||auth.uid()||':'||promo.id,'Promosyon · '||promo.code);
  end if;
  if promo.vip_days>0 then
    select greatest(now(),coalesce(max(expires_at),now())) + make_interval(days=>promo.vip_days)
      into vip_end from drabornseries.dbs_vip_subscriptions
      where user_id=auth.uid() and status in ('active','grace','cancelled') and expires_at>now();
    insert into drabornseries.dbs_vip_subscriptions(user_id,provider,product_id,status,starts_at,expires_at,auto_renew)
      values(auth.uid(),'promotion','promo:'||promo.id,'active',now(),vip_end,false);
  end if;
  insert into drabornseries.dbs_promo_redemptions(user_id,promo_id,coins,vip_days,vip_until)
    values(auth.uid(),promo.id,promo.coins,promo.vip_days,vip_end);
  update drabornseries.dbs_promo_codes set uses=uses+1 where id=promo.id;
  return jsonb_build_object('coins',promo.coins,'vip_days',promo.vip_days,'vip_until',vip_end);
end $$;
create function drabornseries.dbs_redeem_reward(code text) returns jsonb
language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_redeem_reward(code) $$;
-- Keep the previous mobile client's integer response compatible.
create or replace function dbs_series_private.dbs_redeem(code text) returns integer
language plpgsql security definer set search_path='' as $$
begin return (dbs_series_private.dbs_redeem_reward(code)->>'coins')::integer; end $$;
revoke all on function dbs_series_private.dbs_redeem_reward(text), drabornseries.dbs_redeem_reward(text) from public,anon;
grant execute on function dbs_series_private.dbs_redeem_reward(text), drabornseries.dbs_redeem_reward(text) to authenticated,service_role;

create function drabornseries.dbs_studio_save_promo(actor uuid,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved drabornseries.dbs_promo_codes; existing drabornseries.dbs_promo_codes;
  code_value text; coins_value integer; days_value integer; limit_value integer; expiry timestamptz; promo_id uuid;
begin
  if auth.role()<>'service_role' or not exists(select 1 from drabornseries.dbs_admin_users where user_id=actor and role in ('owner','editor')) then raise exception 'EDITOR_REQUIRED'; end if;
  code_value:=upper(trim(payload->>'code')); coins_value:=(payload->>'coins')::integer;
  days_value:=coalesce((payload->>'vip_days')::integer,0); limit_value:=(payload->>'max_uses')::integer;
  expiry:=(payload->>'expires_at')::timestamptz; promo_id:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
  if code_value is null or code_value !~ '^[A-Z0-9][A-Z0-9_-]{2,63}$' or coins_value is null or days_value is null
    or coins_value not between 0 and 1000000 or days_value not between 0 and 3650 or coins_value+days_value=0
    or limit_value is null or limit_value not between 1 and 1000000 or expiry is null then raise exception 'INVALID_PROMO_SETTINGS'; end if;
  select * into existing from drabornseries.dbs_promo_codes where id=promo_id for update;
  if existing.uses>0 and (existing.code<>code_value or existing.coins<>coins_value or existing.vip_days<>days_value) then raise exception 'PROMO_ALREADY_USED'; end if;
  if limit_value<coalesce(existing.uses,0) then raise exception 'INVALID_PROMO_SETTINGS'; end if;
  insert into drabornseries.dbs_promo_codes(id,code,coins,vip_days,max_uses,expires_at,active)
    values(promo_id,code_value,coins_value,days_value,limit_value,expiry,coalesce((payload->>'active')::boolean,true))
    on conflict(id) do update set code=excluded.code,coins=excluded.coins,vip_days=excluded.vip_days,max_uses=excluded.max_uses,expires_at=excluded.expires_at,active=excluded.active
    returning * into saved;
  insert into drabornseries.dbs_admin_logs(admin_id,action,target,detail)
    values(actor,'save','dbs_promo_codes',jsonb_build_object('id',saved.id,'code',saved.code,'coins',saved.coins,'vip_days',saved.vip_days));
  return to_jsonb(saved);
end $$;
revoke all on function drabornseries.dbs_studio_save_promo(uuid,jsonb) from public,anon,authenticated;
grant execute on function drabornseries.dbs_studio_save_promo(uuid,jsonb) to service_role;

create function dbs_series_private.dbs_search_text(value text) returns text
language sql immutable parallel safe set search_path='' as $$
  select translate(lower(coalesce(value,'')),'çğıöşüâîûéèêëáàäíìïóòôúù','cgiosuaiueeeeaaaiiiooouu')
$$;
create function drabornseries.dbs_studio_search_series(search text,page_limit integer,page_offset integer) returns jsonb
language sql stable security invoker set search_path='' as $$
  with input as (select dbs_series_private.dbs_search_text(trim(search)) as q),
  ranked as (select s,
    case when q='' then 0 when dbs_series_private.dbs_search_text(s.title)=q then 0
      when starts_with(dbs_series_private.dbs_search_text(s.title),q) then 1
      when strpos(dbs_series_private.dbs_search_text(s.title),q)>0 then 2
      when strpos(dbs_series_private.dbs_search_text(s.slug||' '||coalesce(s.alternative_title,'')),q)>0 then 3 else 4 end as rank
    from drabornseries.dbs_series s cross join input
    where q='' or strpos(dbs_series_private.dbs_search_text(s.title||' '||s.slug||' '||coalesce(s.alternative_title,'')||' '||coalesce(s.short_description,'')||' '||coalesce(s.description,'')||' '||coalesce(s.tags::text,'')),q)>0),
  paged as (select * from ranked order by rank, (s).title,(s).id limit greatest(1,least(50,page_limit)) offset greatest(0,least(100000,page_offset)))
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s) order by rank,(s).title,(s).id) from paged),'[]'::jsonb),'total',(select count(*) from ranked))
$$;
revoke all on function dbs_series_private.dbs_search_text(text), drabornseries.dbs_studio_search_series(text,integer,integer) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_search_text(text), drabornseries.dbs_studio_search_series(text,integer,integer) to service_role;

-- The trusted Edge service can ask the existing R2 Worker for a short-lived preview
-- without exposing a service key to the subtitle runner or changing browser permissions.
create or replace function drabornseries.dbs_is_admin() returns boolean
language sql stable security invoker set search_path='' as $$
  select case when (select auth.role())='service_role' then true else dbs_series_private.dbs_admin() end
$$;

create table drabornseries.dbs_auto_subtitle_jobs (
  id uuid primary key default gen_random_uuid(), episode_id uuid not null references drabornseries.dbs_episodes on delete cascade,
  source_key text not null, status text not null default 'queued' check(status in ('queued','processing','completed','no_speech','failed','superseded','manual')),
  attempts integer not null default 0, lease_id uuid, lease_until timestamptz,
  detected_language text, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(episode_id,source_key)
);
alter table drabornseries.dbs_auto_subtitle_jobs enable row level security;
revoke all on drabornseries.dbs_auto_subtitle_jobs from anon,authenticated;
grant all on drabornseries.dbs_auto_subtitle_jobs to service_role;
create policy dbs_backend_only on drabornseries.dbs_auto_subtitle_jobs for all to service_role using(true) with check(true);
create index dbs_caption_pending on drabornseries.dbs_auto_subtitle_jobs(status,updated_at);

create function dbs_series_private.dbs_queue_caption() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.provider='r2' and new.r2_key is not null and not exists(select 1 from drabornseries.dbs_subtitles
    where episode_id=new.episode_id and language in ('tr','tr-TR','tur','Turkish','Türkçe') and asset_key not like 'dbs-auto/%') then
    insert into drabornseries.dbs_auto_subtitle_jobs(episode_id,source_key) values(new.episode_id,new.r2_key) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function dbs_series_private.dbs_queue_caption() from public,anon,authenticated;
create trigger dbs_queue_r2_caption after insert or update of provider,r2_key on drabornseries.dbs_video_assets
for each row execute function dbs_series_private.dbs_queue_caption();

create function drabornseries.dbs_claim_caption() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job drabornseries.dbs_auto_subtitle_jobs;
begin
  if auth.role()<>'service_role' then raise exception 'ACCESS_DENIED'; end if;
  select * into job from drabornseries.dbs_auto_subtitle_jobs
    where (status in ('queued','failed') or (status='processing' and lease_until<now())) and attempts<3
    order by created_at for update skip locked limit 1;
  if job.id is null then return null; end if;
  update drabornseries.dbs_auto_subtitle_jobs set status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),
    lease_until=now()+interval '110 minutes',updated_at=now(),error=null where id=job.id returning * into job;
  return to_jsonb(job);
end $$;
create function drabornseries.dbs_finish_caption(job_id uuid,lease uuid,outcome text,language text,cause text default null,actual_duration integer default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job drabornseries.dbs_auto_subtitle_jobs; current_key text;
begin
  if auth.role()<>'service_role' then raise exception 'ACCESS_DENIED'; end if;
  if outcome not in ('completed','no_speech','failed') then raise exception 'INVALID_CAPTION'; end if;
  select * into job from drabornseries.dbs_auto_subtitle_jobs where id=job_id for update;
  if job.id is null or job.status<>'processing' or job.lease_id<>lease or job.lease_until<now() then raise exception 'CAPTION_LEASE_EXPIRED'; end if;
  select r2_key into current_key from drabornseries.dbs_video_assets where episode_id=job.episode_id and provider='r2' for update;
  if current_key is distinct from job.source_key then outcome:='superseded';
  elsif exists(select 1 from drabornseries.dbs_subtitles where episode_id=job.episode_id and language in ('tr','tr-TR','tur','Turkish','Türkçe') and asset_key not like 'dbs-auto/%') then outcome:='manual';
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
revoke all on function drabornseries.dbs_claim_caption(),drabornseries.dbs_finish_caption(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function drabornseries.dbs_claim_caption(),drabornseries.dbs_finish_caption(uuid,uuid,text,text,text,integer) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('dbs-auto-subtitles','dbs-auto-subtitles',false,300000,array['text/vtt']) on conflict(id) do nothing;
-- Only R2 uploads without existing Turkish captions enter the new queue.
insert into drabornseries.dbs_auto_subtitle_jobs(episode_id,source_key)
  select a.episode_id,a.r2_key from drabornseries.dbs_video_assets a
  where a.provider='r2' and a.r2_key is not null and not exists(select 1 from drabornseries.dbs_subtitles s
    where s.episode_id=a.episode_id and s.language in ('tr','tr-TR','tur','Turkish','Türkçe'))
  on conflict do nothing;
