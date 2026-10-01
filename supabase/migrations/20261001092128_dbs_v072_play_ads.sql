-- Subscription updates come only from verified Google API responses.
alter table drabornseries.dbs_vip_subscriptions drop constraint dbs_vip_subscriptions_status_check;
alter table drabornseries.dbs_vip_subscriptions add constraint dbs_vip_subscriptions_status_check check(status in ('active','grace','cancelled','expired','paused','on_hold','revoked','pending'));
alter table drabornseries.dbs_vip_subscriptions add column play_checked_at timestamptz;
alter table drabornseries.dbs_vip_subscriptions add column replaced_by_token_hash text;
create function dbs_series_private.dbs_sync_play_subscription(account uuid,product text,token_hash text,order_id text,subscription_status text,expires_at timestamptz,auto_renew boolean,receipt jsonb,observed_at timestamptz,linked_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior drabornseries.dbs_purchases; sub drabornseries.dbs_vip_subscriptions; purchase_id uuid;
begin
 if token_hash !~ '^[a-f0-9]{64}$' or subscription_status not in ('active','grace','cancelled','expired','paused','on_hold','revoked','pending') or expires_at is null or observed_at>now()+interval '1 minute' then raise exception 'INVALID_SUBSCRIPTION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(token_hash,0));
 if not exists(select 1 from drabornseries.dbs_profiles where user_id=account and status='active') then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into prior from drabornseries.dbs_purchases p where p.token_hash=dbs_sync_play_subscription.token_hash;
 if prior.id is not null and (prior.user_id<>account or prior.product_id<>product) then raise exception 'TOKEN_ALREADY_USED'; end if;
 if not exists(select 1 from drabornseries.dbs_google_play_products p where p.id=product and p.kind='vip' and (p.active or prior.id is not null)) then raise exception 'PRODUCT_INACTIVE'; end if;
 if prior.id is null then
   if subscription_status not in ('active','grace','cancelled') or expires_at<=now() then raise exception 'SUBSCRIPTION_NOT_ACTIVE'; end if;
   insert into drabornseries.dbs_purchases(user_id,product_id,token_hash,order_id,status) values(account,product,token_hash,order_id,'verified') returning id into purchase_id;
 else purchase_id:=prior.id; end if;
 select * into sub from drabornseries.dbs_vip_subscriptions v where v.token_hash=dbs_sync_play_subscription.token_hash;
 if sub.replaced_by_token_hash is not null or sub.play_checked_at>observed_at then return jsonb_build_object('stale',true,'entitled',sub.status in ('active','grace','cancelled') and sub.expires_at>now(),'status',sub.status); end if;
 insert into drabornseries.dbs_purchase_receipts(purchase_id,receipt) values(purchase_id,receipt) on conflict on constraint dbs_purchase_receipts_purchase_id_key do update set receipt=excluded.receipt;
 insert into drabornseries.dbs_vip_subscriptions(user_id,provider,product_id,token_hash,status,expires_at,auto_renew,play_checked_at)
 values(account,'google_play',product,token_hash,subscription_status,expires_at,auto_renew,observed_at)
 on conflict on constraint dbs_vip_subscriptions_token_hash_key do update set status=excluded.status,expires_at=excluded.expires_at,auto_renew=excluded.auto_renew,play_checked_at=excluded.play_checked_at,updated_at=now();
 if linked_hash is not null and linked_hash<>token_hash then
   update drabornseries.dbs_vip_subscriptions v set status='revoked',auto_renew=false,replaced_by_token_hash=dbs_sync_play_subscription.token_hash,updated_at=now()
   where v.token_hash=linked_hash and v.user_id=account and v.provider='google_play';
 end if;
 update drabornseries.dbs_purchases p set status=case when subscription_status='revoked' then 'refunded' else 'verified' end where p.id=purchase_id;
 return jsonb_build_object('duplicate',prior.id is not null,'entitled',subscription_status in ('active','grace','cancelled') and expires_at>now(),'status',subscription_status);
end $$;
create function drabornseries.dbs_sync_play_subscription(account uuid,product text,token_hash text,order_id text,subscription_status text,expires_at timestamptz,auto_renew boolean,receipt jsonb,observed_at timestamptz,linked_hash text default null) returns jsonb language sql security invoker set search_path='' as $$
 select dbs_series_private.dbs_sync_play_subscription(account,product,token_hash,order_id,subscription_status,expires_at,auto_renew,receipt,observed_at,linked_hash) $$;
revoke all on function drabornseries.dbs_sync_play_subscription(uuid,text,text,text,text,timestamptz,boolean,jsonb,timestamptz,text),dbs_series_private.dbs_sync_play_subscription(uuid,text,text,text,text,timestamptz,boolean,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function drabornseries.dbs_sync_play_subscription(uuid,text,text,text,text,timestamptz,boolean,jsonb,timestamptz,text),dbs_series_private.dbs_sync_play_subscription(uuid,text,text,text,text,timestamptz,boolean,jsonb,timestamptz,text) to service_role;
update drabornseries.dbs_google_play_products set active=true where kind='vip' and id in ('dbs_vip_weekly','dbs_vip_monthly','dbs_vip_yearly');

-- Reward tickets and credits are server-only; the SDK cannot mint currency.
create table drabornseries.dbs_ad_tickets (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references drabornseries.dbs_profiles on delete cascade,
 episode_id uuid references drabornseries.dbs_episodes on delete cascade,coins integer not null default 3 check(coins between 0 and 20),ad_unit text not null,
 status text not null default 'pending' check(status in ('pending','completed')),transaction_id text unique,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '2 hours'
);
alter table drabornseries.dbs_ad_tickets enable row level security;
revoke all on drabornseries.dbs_ad_tickets from anon,authenticated;
grant all on drabornseries.dbs_ad_tickets to service_role;
create policy dbs_backend_only on drabornseries.dbs_ad_tickets for all to service_role using(true) with check(true);
create index dbs_ad_tickets_account_date on drabornseries.dbs_ad_tickets(user_id,created_at);
create function dbs_series_private.dbs_complete_ad(ticket uuid,account uuid,transaction text,ad_unit text,earned_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item drabornseries.dbs_ad_tickets; earned_day date:=(earned_at at time zone 'Europe/Istanbul')::date;
begin
 perform 1 from drabornseries.dbs_borncoins_wallet where user_id=account for update;
 if not found or not exists(select 1 from drabornseries.dbs_profiles where user_id=account and status='active') then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into item from drabornseries.dbs_ad_tickets where id=ticket for update;
 if item.user_id is distinct from account or item.ad_unit is distinct from ad_unit or length(transaction) not between 8 and 256 or transaction !~ '^[A-Za-z0-9_-]+$' or earned_at<item.created_at-interval '1 minute' or earned_at>item.expires_at or earned_at>now()+interval '5 minutes' then raise exception 'INVALID_AD_TICKET'; end if;
 if item.status='completed' then
   if item.transaction_id<>transaction then raise exception 'AD_TICKET_ALREADY_USED'; end if;
   return jsonb_build_object('duplicate',true,'coins',item.coins,'unlocked',item.episode_id is not null);
 end if;
 if exists(select 1 from drabornseries.dbs_ad_events where transaction_id=transaction) then raise exception 'AD_TRANSACTION_ALREADY_USED'; end if;
 if (select count(*) from drabornseries.dbs_ad_events where user_id=account and dbs_ad_events.reward_date=earned_day)>=5 then raise exception 'AD_DAILY_LIMIT'; end if;
 if item.episode_id is not null and not exists(select 1 from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where e.id=item.episode_id and e.access_type='ad' and e.status='published' and s.status='published' and e.publish_at<=now()) then raise exception 'EPISODE_UNAVAILABLE'; end if;
 insert into drabornseries.dbs_ad_events(transaction_id,user_id,reward_date,placement) values(transaction,account,earned_day,case when item.episode_id is null then 'coins' else 'episode' end);
 if item.coins>0 then perform dbs_series_private.dbs_ledger(account,item.coins,'ad','ad:'||transaction,'Reklam ödülü'); end if;
 if item.episode_id is not null then insert into drabornseries.dbs_episode_unlocks(user_id,episode_id,source) values(account,item.episode_id,'ad') on conflict(user_id,episode_id) do nothing; end if;
 update drabornseries.dbs_ad_tickets set status='completed',transaction_id=transaction where id=ticket;
 return jsonb_build_object('coins',item.coins,'unlocked',item.episode_id is not null);
end $$;
create function drabornseries.dbs_complete_ad(ticket uuid,account uuid,transaction text,ad_unit text,earned_at timestamptz) returns jsonb language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_complete_ad(ticket,account,transaction,ad_unit,earned_at) $$;
revoke all on function drabornseries.dbs_complete_ad(uuid,uuid,text,text,timestamptz),dbs_series_private.dbs_complete_ad(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function drabornseries.dbs_complete_ad(uuid,uuid,text,text,timestamptz),dbs_series_private.dbs_complete_ad(uuid,uuid,text,text,timestamptz) to service_role;
notify pgrst,'reload schema';
