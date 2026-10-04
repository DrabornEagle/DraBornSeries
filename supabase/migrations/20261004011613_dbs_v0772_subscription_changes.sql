-- Test flags come only from Google-verified receipts; clients retain read-only RLS.
alter table drabornseries.dbs_vip_subscriptions add column is_test boolean not null default false;
update drabornseries.dbs_vip_subscriptions s set is_test=r.receipt ? 'testPurchase'
from drabornseries.dbs_purchases p join drabornseries.dbs_purchase_receipts r on r.purchase_id=p.id
where s.provider='google_play' and s.token_hash=p.token_hash;

create or replace function dbs_series_private.dbs_sync_play_subscription(account uuid,product text,token_hash text,order_id text,subscription_status text,expires_at timestamptz,auto_renew boolean,receipt jsonb,observed_at timestamptz,linked_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior drabornseries.dbs_purchases; sub drabornseries.dbs_vip_subscriptions; purchase_id uuid;
begin
 if token_hash !~ '^[a-f0-9]{64}$' or subscription_status not in ('active','grace','cancelled','expired','paused','on_hold','revoked','pending') or expires_at is null or observed_at>now()+interval '1 minute' then raise exception 'INVALID_SUBSCRIPTION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('dbs-play-account:'||account::text,0));
 perform pg_advisory_xact_lock(hashtextextended(token_hash,0));
 if not exists(select 1 from drabornseries.dbs_profiles where user_id=account and status='active') then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into prior from drabornseries.dbs_purchases p where p.token_hash=dbs_sync_play_subscription.token_hash;
 if prior.id is not null and (prior.user_id<>account or prior.product_id<>product) then raise exception 'TOKEN_ALREADY_USED'; end if;
 if not exists(select 1 from drabornseries.dbs_google_play_products p where p.id=product and p.kind='vip' and (p.active or prior.id is not null)) then raise exception 'PRODUCT_INACTIVE'; end if;
 if linked_hash is not null and (linked_hash !~ '^[a-f0-9]{64}$' or exists(select 1 from drabornseries.dbs_purchases p where p.token_hash=linked_hash and p.user_id<>account)) then raise exception 'TOKEN_ALREADY_USED'; end if;
 if prior.id is null then
   if exists(select 1 from drabornseries.dbs_vip_subscriptions v where v.user_id=account and v.provider='google_play' and v.token_hash<>dbs_sync_play_subscription.token_hash
     and (v.status in ('active','grace','cancelled') and v.expires_at>now() or v.status in ('pending','paused','on_hold'))
     and v.token_hash is distinct from linked_hash) then raise exception 'ACTIVE_SUBSCRIPTION_EXISTS'; end if;
   if subscription_status not in ('active','grace','cancelled') or expires_at<=now() then raise exception 'SUBSCRIPTION_NOT_ACTIVE'; end if;
   insert into drabornseries.dbs_purchases(user_id,product_id,token_hash,order_id,status) values(account,product,token_hash,order_id,'verified') returning id into purchase_id;
 else purchase_id:=prior.id; end if;
 select * into sub from drabornseries.dbs_vip_subscriptions v where v.token_hash=dbs_sync_play_subscription.token_hash;
 if sub.replaced_by_token_hash is not null or sub.play_checked_at>observed_at then return jsonb_build_object('stale',true,'entitled',sub.status in ('active','grace','cancelled') and sub.expires_at>now(),'status',sub.status,'isTest',sub.is_test); end if;
 insert into drabornseries.dbs_purchase_receipts(purchase_id,receipt) values(purchase_id,receipt) on conflict on constraint dbs_purchase_receipts_purchase_id_key do update set receipt=excluded.receipt;
 insert into drabornseries.dbs_vip_subscriptions(user_id,provider,product_id,token_hash,status,expires_at,auto_renew,play_checked_at,is_test)
 values(account,'google_play',product,token_hash,subscription_status,expires_at,auto_renew,observed_at,receipt ? 'testPurchase')
 on conflict on constraint dbs_vip_subscriptions_token_hash_key do update set status=excluded.status,expires_at=excluded.expires_at,auto_renew=excluded.auto_renew,play_checked_at=excluded.play_checked_at,is_test=excluded.is_test,updated_at=now();
 if linked_hash is not null and linked_hash<>token_hash and subscription_status in ('active','grace','cancelled') and expires_at>now() then
   update drabornseries.dbs_vip_subscriptions v set status='revoked',auto_renew=false,replaced_by_token_hash=dbs_sync_play_subscription.token_hash,updated_at=now()
   where v.token_hash=linked_hash and v.user_id=account and v.provider='google_play';
 end if;
 update drabornseries.dbs_purchases p set status=case when subscription_status='revoked' then 'refunded' else 'verified' end where p.id=purchase_id;
 return jsonb_build_object('duplicate',prior.id is not null,'entitled',subscription_status in ('active','grace','cancelled') and expires_at>now(),'status',subscription_status,'isTest',receipt ? 'testPurchase');
end $$;

revoke all on function dbs_series_private.dbs_sync_play_subscription(uuid,text,text,text,text,timestamptz,boolean,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_sync_play_subscription(uuid,text,text,text,text,timestamptz,boolean,jsonb,timestamptz,text) to service_role;
notify pgrst, 'reload schema';
