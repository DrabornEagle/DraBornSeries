-- Series-only admin features. No shared public tables or Auth settings are changed.
alter table drabornseries.dbs_series add column trailer_url text;
alter table drabornseries.dbs_vip_subscriptions
  add column admin_request_id uuid unique;

create index dbs_watch_progress_updated_idx on drabornseries.dbs_watch_progress(updated_at);
create index dbs_user_sessions_seen_idx on drabornseries.dbs_user_sessions(last_seen_at);

create function dbs_series_private.dbs_admin_grant_vip(account uuid, days integer, reason text, request_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare grant_end timestamptz;
begin
  if not exists(select 1 from drabornseries.dbs_admin_users where user_id=auth.uid() and role='owner') then
    raise exception 'OWNER_REQUIRED';
  end if;
  if account is null or request_id is null or days not in (7,30,365) or length(trim(coalesce(reason,'')))<5 then
    raise exception 'INVALID_GRANT';
  end if;
  if not exists(select 1 from drabornseries.dbs_profiles where user_id=account and status='active') then
    raise exception 'ACCOUNT_UNAVAILABLE';
  end if;
  perform 1 from drabornseries.dbs_profiles where user_id=account for update;
  select expires_at into grant_end from drabornseries.dbs_vip_subscriptions where admin_request_id=request_id;
  if found then return grant_end; end if;
  select greatest(now(),coalesce(max(expires_at),now())) + make_interval(days=>days)
    into grant_end from drabornseries.dbs_vip_subscriptions
    where user_id=account and provider='admin' and status='active' and expires_at>now();
  insert into drabornseries.dbs_vip_subscriptions(user_id,provider,product_id,status,starts_at,expires_at,auto_renew,admin_request_id)
    values(account,'admin','dbs_vip_admin_'||days,'active',now(),grant_end,false,request_id);
  insert into drabornseries.dbs_admin_logs(admin_id,action,target,detail)
    values(auth.uid(),'vip_grant',account::text,jsonb_build_object('days',days,'reason',reason,'request_id',request_id,'expires_at',grant_end));
  return grant_end;
end $$;

create function drabornseries.dbs_admin_grant_vip(account uuid, days integer, reason text, request_id uuid)
returns timestamptz language sql security invoker set search_path='' as $$
  select dbs_series_private.dbs_admin_grant_vip(account,days,reason,request_id)
$$;

create function dbs_series_private.dbs_admin_metrics()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not dbs_series_private.dbs_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  with activity as (
    select user_id, last_seen_at as seen_at from drabornseries.dbs_user_sessions where revoked_at is null
    union all
    select user_id, updated_at from drabornseries.dbs_watch_progress
  ),
  active_counts as (
    select count(distinct user_id) filter(where seen_at>=now()-interval '1 day') as dau,
           count(distinct user_id) filter(where seen_at>=now()-interval '7 days') as wau,
           count(distinct user_id) filter(where seen_at>=now()-interval '30 days') as mau
      from activity
  ),
  progress as (
    select count(*) filter(where updated_at>=now()-interval '1 day') as daily,
           count(*) filter(where updated_at>=now()-interval '7 days') as weekly,
           count(*) filter(where updated_at>=now()-interval '30 days') as monthly,
           round(avg(position_seconds)) as avg_seconds,
           round(100.0*count(*) filter(where completed)/nullif(count(*),0),1) as completion_pct
      from drabornseries.dbs_watch_progress
  ),
  coins as (
    select coalesce(sum(amount) filter(where amount>0),0) as earned,
           coalesce(-sum(amount) filter(where amount<0),0) as spent
      from drabornseries.dbs_borncoins_transactions
  )
  select jsonb_build_object(
    'users',(select count(*) from drabornseries.dbs_profiles where status<>'deleted'),
    'vip_users',(select count(distinct user_id) from drabornseries.dbs_vip_subscriptions where status in ('active','grace') and expires_at>now()),
    'dau',(select dau from active_counts), 'wau',(select wau from active_counts), 'mau',(select mau from active_counts),
    'daily',(select daily from progress), 'weekly',(select weekly from progress), 'monthly',(select monthly from progress),
    'average_seconds',(select avg_seconds from progress), 'completion_pct',(select completion_pct from progress),
    'coin_earned',(select earned from coins), 'coin_spent',(select spent from coins),
    'coin_buyers',(select count(distinct user_id) from drabornseries.dbs_purchases where status in ('verified','completed')),
    'ad_unlocks',(select count(*) from drabornseries.dbs_episode_unlocks where source='ad'),
    'all_unlocks',(select count(*) from drabornseries.dbs_episode_unlocks),
    'top_series',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
      select s.title, count(*) as viewers from drabornseries.dbs_watch_progress w
      join drabornseries.dbs_episodes e on e.id=w.episode_id
      join drabornseries.dbs_series s on s.id=e.series_id
      group by s.id,s.title order by viewers desc,s.title limit 5
    ) t),
    'top_episodes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
      select s.title as series, e.title, count(*) as viewers from drabornseries.dbs_watch_progress w
      join drabornseries.dbs_episodes e on e.id=w.episode_id
      join drabornseries.dbs_series s on s.id=e.series_id
      group by e.id,e.title,s.title order by viewers desc,e.title limit 5
    ) t),
    'abandoned',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
      select s.title as series,e.title,count(*) as viewers from drabornseries.dbs_watch_progress w
      join drabornseries.dbs_episodes e on e.id=w.episode_id
      join drabornseries.dbs_series s on s.id=e.series_id
      where w.position_seconds>0 and not w.completed
      group by e.id,e.title,s.title order by viewers desc,e.title limit 5
    ) t)
  ) into result;
  return result;
end $$;

create function drabornseries.dbs_admin_metrics()
returns jsonb language sql stable security invoker set search_path='' as $$
  select dbs_series_private.dbs_admin_metrics()
$$;

revoke all on function dbs_series_private.dbs_admin_grant_vip(uuid,integer,text,uuid),
  drabornseries.dbs_admin_grant_vip(uuid,integer,text,uuid),
  dbs_series_private.dbs_admin_metrics(),drabornseries.dbs_admin_metrics() from public,anon;
grant execute on function dbs_series_private.dbs_admin_grant_vip(uuid,integer,text,uuid),
  drabornseries.dbs_admin_grant_vip(uuid,integer,text,uuid),
  dbs_series_private.dbs_admin_metrics(),drabornseries.dbs_admin_metrics() to authenticated;
notify pgrst,'reload schema';
