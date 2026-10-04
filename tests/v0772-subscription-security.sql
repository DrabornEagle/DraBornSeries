-- Temporary Auth, comments and payments only. All fixtures roll back.
begin;
set local statement_timeout='30s';
select set_config('dbs.test_user',gen_random_uuid()::text,true);
select set_config('dbs.test_session',gen_random_uuid()::text,true);
select set_config('dbs.test_series',gen_random_uuid()::text,true);
select set_config('dbs.test_episode',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values(current_setting('dbs.test_user')::uuid,'authenticated','authenticated','v0772-'||current_setting('dbs.test_user')||'@example.invalid',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('dbs.test_session')::uuid,current_setting('dbs.test_user')::uuid,now(),now());
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dbs.test_user'),'role','authenticated','session_id',current_setting('dbs.test_session'))::text,true);
set local role authenticated;
select drabornseries.dbs_bootstrap('v0772-test','Payment fixture','test');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$ declare
 account uuid:=current_setting('dbs.test_user')::uuid;
 weekly text:=encode(sha256(gen_random_uuid()::text::bytea),'hex');
 monthly text:=encode(sha256(gen_random_uuid()::text::bytea),'hex');
 independent text:=encode(sha256(gen_random_uuid()::text::bytea),'hex');
 result jsonb; denied boolean; actual_expiry timestamptz:=now()+interval '5 minutes';
begin
 result:=drabornseries.dbs_sync_play_subscription(account,'dbs_vip_weekly',weekly,'test-weekly','active',actual_expiry,true,'{"testPurchase":{}}',now());
 if not (result->>'isTest')::boolean or not (result->>'entitled')::boolean then raise exception 'Test subscription not identified'; end if;
 if not exists(select 1 from drabornseries.dbs_vip_subscriptions v where v.token_hash=weekly and v.is_test and v.expires_at=actual_expiry) then raise exception 'Test receipt expiry was fabricated'; end if;
 denied:=false;
 begin perform drabornseries.dbs_sync_play_subscription(account,'dbs_vip_monthly',independent,'duplicate-monthly','active',now()+interval '1 month',true,'{}',now());
 exception when others then if sqlerrm='ACTIVE_SUBSCRIPTION_EXISTS' then denied:=true; else raise; end if; end;
 if not denied or (select count(*) from drabornseries.dbs_purchases where user_id=account)<>1 then raise exception 'Independent second subscription allowed'; end if;
 denied:=false;
 begin perform drabornseries.dbs_sync_play_subscription(account,'dbs_vip_monthly',monthly,'pending-change','pending',now()+interval '1 month',true,'{}',now(),weekly);
 exception when others then if sqlerrm='SUBSCRIPTION_NOT_ACTIVE' then denied:=true; else raise; end if; end;
 if not denied or not exists(select 1 from drabornseries.dbs_vip_subscriptions v where v.token_hash=weekly and v.status='active') then raise exception 'Pending plan change revoked paid access'; end if;
 result:=drabornseries.dbs_sync_play_subscription(account,'dbs_vip_monthly',monthly,'completed-change','active',now()+interval '1 month',true,'{}',now()+interval '1 second',weekly);
 if not (result->>'entitled')::boolean or (result->>'isTest')::boolean then raise exception 'Real monthly replacement failed'; end if;
 if (select count(*) from drabornseries.dbs_vip_subscriptions where user_id=account and status in ('active','grace','cancelled') and expires_at>now())<>1 then raise exception 'Replacement left two active plans'; end if;
 if not exists(select 1 from drabornseries.dbs_vip_subscriptions v where v.token_hash=weekly and v.status='revoked' and v.replaced_by_token_hash=monthly) then raise exception 'Old token not replaced'; end if;
 result:=drabornseries.dbs_sync_play_subscription(account,'dbs_vip_weekly',weekly,'old-renewal','active',now()+interval '5 minutes',true,'{"testPurchase":{}}',now()+interval '2 seconds');
 if not (result->>'stale')::boolean or (result->>'entitled')::boolean then raise exception 'Old renewal restored the replaced plan'; end if;
 result:=drabornseries.dbs_sync_play_subscription(account,'dbs_vip_monthly',monthly,'monthly-cancelled','cancelled',now()+interval '1 month',false,'{}',now()+interval '3 seconds');
 if not (result->>'entitled')::boolean then raise exception 'Cancelled renewal removed the paid period'; end if;
end $$;
reset role;
-- Authenticated clients can see their test label, but cannot edit it or the entitlement.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dbs.test_user'),'role','authenticated','session_id',current_setting('dbs.test_session'))::text,true);
set local role authenticated;
do $$ declare denied boolean:=false; begin
 if (select count(*) from drabornseries.dbs_vip_subscriptions)<>2 then raise exception 'Own membership read failed'; end if;
 begin update drabornseries.dbs_vip_subscriptions set is_test=false where user_id=auth.uid(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client changed test flag'; end if;
end $$;
reset role;
rollback;
select 'v0772 plan replacement, duplicate prevention, authoritative test expiry and RLS passed; fixtures rolled back' as result;
