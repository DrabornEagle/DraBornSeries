-- Fixtures and all writes roll back. Never use a real account for reward tests.
begin;
set local statement_timeout='30s';
select set_config('dbs.test_user',gen_random_uuid()::text,true);
select set_config('dbs.test_session',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(current_setting('dbs.test_user')::uuid,'authenticated','authenticated','v071-'||current_setting('dbs.test_user')||'@example.invalid',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('dbs.test_session')::uuid,current_setting('dbs.test_user')::uuid,now(),now());
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dbs.test_user'),'role','authenticated','session_id',current_setting('dbs.test_session'))::text,true);
set local role authenticated;
select drabornseries.dbs_bootstrap('v071-test','Promotion transaction test','test');
reset role;
insert into drabornseries.dbs_admin_users(user_id,role) values(current_setting('dbs.test_user')::uuid,'editor');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('dbs.test_combo','COMBO-'||replace(current_setting('dbs.test_user'),'-',''),true);
select set_config('dbs.test_vip','VIP-'||replace(current_setting('dbs.test_user'),'-',''),true);
select set_config('dbs.test_coin','COIN-'||replace(current_setting('dbs.test_user'),'-',''),true);
select drabornseries.dbs_studio_save_promo(current_setting('dbs.test_user')::uuid,jsonb_build_object('code',current_setting('dbs.test_combo'),'coins',25,'vip_days',3,'max_uses',2,'expires_at',now()+interval '1 day'));
select drabornseries.dbs_studio_save_promo(current_setting('dbs.test_user')::uuid,jsonb_build_object('code',current_setting('dbs.test_vip'),'coins',0,'vip_days',4,'max_uses',1,'expires_at',now()+interval '1 day'));
select drabornseries.dbs_studio_save_promo(current_setting('dbs.test_user')::uuid,jsonb_build_object('code',current_setting('dbs.test_coin'),'coins',7,'vip_days',0,'max_uses',1,'expires_at',now()+interval '1 day'));
insert into drabornseries.dbs_vip_subscriptions(user_id,provider,status,expires_at)
 values(current_setting('dbs.test_user')::uuid,'google_play','cancelled',now()+interval '5 days');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dbs.test_user'),'role','authenticated','session_id',current_setting('dbs.test_session'))::text,true);
do $$
declare result jsonb; old_balance bigint; after_balance bigint; denied boolean;
begin
 select balance into old_balance from drabornseries.dbs_borncoins_wallet where user_id=auth.uid();
 result:=drabornseries.dbs_redeem_reward(lower(current_setting('dbs.test_combo')));
 if (result->>'coins')::integer<>25 or (result->>'vip_days')::integer<>3 or (result->>'vip_until')::timestamptz<>now()+interval '8 days' then raise exception 'Combined promotion reward or VIP extension failed'; end if;
 denied:=false;
 begin perform drabornseries.dbs_redeem_reward(current_setting('dbs.test_combo')); exception when others then if sqlerrm='ALREADY_CLAIMED' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Promotion granted twice'; end if;
 result:=drabornseries.dbs_redeem_reward(current_setting('dbs.test_vip'));
 if (result->>'coins')::integer<>0 or (result->>'vip_until')::timestamptz<>now()+interval '12 days' then raise exception 'VIP-only promotion failed'; end if;
 if drabornseries.dbs_redeem_promo(current_setting('dbs.test_coin'))<>7 then raise exception 'Previous client response is incompatible'; end if;
 select balance into after_balance from drabornseries.dbs_borncoins_wallet where user_id=auth.uid();
 if after_balance-old_balance<>32 then raise exception 'Promotion ledger balance is wrong'; end if;
 if (select count(*) from drabornseries.dbs_promo_redemptions where user_id=auth.uid())<>3 then raise exception 'Promotion receipt count is wrong'; end if;
 if exists(select 1 from drabornseries.dbs_vip_subscriptions where user_id=auth.uid() and provider='promotion' and auto_renew) then raise exception 'Promotion started a paid renewal'; end if;
end $$;
set local role authenticated;
do $$
declare denied boolean:=false;
begin
 begin perform drabornseries.dbs_studio_save_promo(auth.uid(),'{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client created a promotion directly'; end if;
 denied:=false;
 begin perform drabornseries.dbs_claim_caption(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client claimed a private caption job'; end if;
 denied:=false;
 begin perform 1 from drabornseries.dbs_auto_subtitle_jobs; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client read private caption jobs'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare promo drabornseries.dbs_promo_codes; denied boolean:=false; fixture jsonb; job jsonb; outcome jsonb; first_title text; needle text;
begin
 select * into promo from drabornseries.dbs_promo_codes where code=upper(current_setting('dbs.test_combo'));
 begin perform drabornseries.dbs_studio_save_promo(current_setting('dbs.test_user')::uuid,to_jsonb(promo)||'{"coins":99}'); exception when others then if sqlerrm='PROMO_ALREADY_USED' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Used promotion reward changed'; end if;
 needle:='V071-'||current_setting('dbs.test_user');
 fixture:=drabornseries.dbs_studio_save_series(current_setting('dbs.test_user')::uuid,jsonb_build_object('series',jsonb_build_object('title',needle,'slug',lower(needle),'video_orientation','portrait'),
   'episodes',jsonb_build_array(jsonb_build_object('number',1,'title','Caption fixture','r2_key','Fixture/'||needle||'.mp4','duration_seconds',60))));
 insert into drabornseries.dbs_series(title,slug,status,description) values('Another fixture','other-'||lower(needle),'draft','Description containing '||needle);
 first_title:=drabornseries.dbs_studio_search_series(needle,1,0)->'rows'->0->>'title';
 if first_title<>needle or (drabornseries.dbs_studio_search_series(needle,1,0)->>'total')::integer<>2 then raise exception 'Search failed to rank the exact title above description matches'; end if;
 if jsonb_array_length(drabornseries.dbs_studio_search_series(needle,1,1)->'rows')<>1 then raise exception 'Search pagination missed the second match'; end if;
 -- The old creation time selects only this fixture, without modifying real pending jobs.
 update drabornseries.dbs_auto_subtitle_jobs set created_at='2000-01-01' where source_key='Fixture/'||needle||'.mp4';
 job:=drabornseries.dbs_claim_caption();
 if job->>'source_key'<>'Fixture/'||needle||'.mp4' or job->>'status'<>'processing' then raise exception 'R2 save did not enqueue or claim the fixture'; end if;
 insert into drabornseries.dbs_subtitles(episode_id,language,label,asset_key) values((job->>'episode_id')::uuid,'tr','Turkish manual','https://example.invalid/manual.vtt');
 outcome:=drabornseries.dbs_finish_caption((job->>'id')::uuid,(job->>'lease_id')::uuid,'completed','en',null,60);
 if outcome->>'status'<>'manual' or exists(select 1 from drabornseries.dbs_subtitles where episode_id=(job->>'episode_id')::uuid and asset_key like 'dbs-auto/%') then raise exception 'Automatic caption overwrote a manual Turkish track'; end if;
 denied:=false;
 begin perform drabornseries.dbs_finish_caption((job->>'id')::uuid,(job->>'lease_id')::uuid,'completed','en'); exception when others then if sqlerrm='CAPTION_LEASE_EXPIRED' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Finished caption lease was reused'; end if;
end $$;
-- Session revocation remains authoritative for every ordinary browser request.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dbs.test_user'),'role','authenticated','session_id',current_setting('dbs.test_session'))::text,true);
delete from auth.sessions where id=current_setting('dbs.test_session')::uuid;
do $$ begin if drabornseries.dbs_is_admin() then raise exception 'Revoked browser session retained admin access'; end if; end $$;
rollback;
select 'v0.7.1 promotion, search, caption permissions and session tests passed; fixtures rolled back' as result;
