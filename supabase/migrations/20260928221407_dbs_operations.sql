create extension if not exists pg_cron with schema pg_catalog;
create function dbs_series_private.dbs_apply_verified_purchase(account uuid, product text, token_hash text, order_id text, subscription_status text, expires_at timestamptz, receipt jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item drabornseries.dbs_google_play_products; prior drabornseries.dbs_purchases; purchase_id uuid;
begin
 select * into item from drabornseries.dbs_google_play_products p where p.id=product and active;
 if item.id is null then raise exception 'PRODUCT_INACTIVE'; end if;
 perform 1 from drabornseries.dbs_borncoins_wallet where user_id=account for update;
 if not found or not exists(select 1 from drabornseries.dbs_profiles where user_id=account and status='active') then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into prior from drabornseries.dbs_purchases p where p.token_hash=dbs_apply_verified_purchase.token_hash;
 if prior.id is not null and (prior.user_id<>account or prior.product_id<>product) then raise exception 'TOKEN_ALREADY_USED'; end if;
 if prior.id is null then
 insert into drabornseries.dbs_purchases(user_id,product_id,token_hash,order_id,status) values(account,product,token_hash,order_id,'verified') returning id into purchase_id;
 insert into drabornseries.dbs_purchase_receipts(purchase_id,receipt) values(purchase_id,receipt);
 else purchase_id:=prior.id; end if;
 if item.kind='coins' then
 perform dbs_series_private.dbs_ledger(account,item.coins,'purchase','google:'||token_hash,'Google Play BornCoins');
 else
 if expires_at<=now() or subscription_status not in ('active','grace','cancelled') then raise exception 'INVALID_SUBSCRIPTION'; end if;
 insert into drabornseries.dbs_vip_subscriptions(user_id,product_id,token_hash,status,expires_at) values(account,product,token_hash,subscription_status,expires_at)
 on conflict(token_hash) do update set status=excluded.status,expires_at=excluded.expires_at,updated_at=now();
 end if;
 return jsonb_build_object('purchase_id',purchase_id,'duplicate',prior.id is not null);
end $$;
create function drabornseries.dbs_apply_verified_purchase(account uuid,product text,token_hash text,order_id text,subscription_status text,expires_at timestamptz,receipt jsonb) returns jsonb language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_apply_verified_purchase(account,product,token_hash,order_id,subscription_status,expires_at,receipt) $$;
revoke all on function drabornseries.dbs_apply_verified_purchase(uuid,text,text,text,text,timestamptz,jsonb),dbs_series_private.dbs_apply_verified_purchase(uuid,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function drabornseries.dbs_apply_verified_purchase(uuid,text,text,text,text,timestamptz,jsonb),dbs_series_private.dbs_apply_verified_purchase(uuid,text,text,text,text,timestamptz,jsonb) to service_role;
create function dbs_series_private.dbs_publish_due() returns integer language plpgsql security definer set search_path='' as $$
declare episode record; published_count integer:=0;
begin
 for episode in select e.id,e.series_id,e.title from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where e.status='scheduled' and e.publish_at<=now() and s.status='published' and exists(select 1 from drabornseries.dbs_video_assets a where a.episode_id=e.id and a.ready) for update of e skip locked loop
 update drabornseries.dbs_episodes set status='published' where id=episode.id;
 insert into drabornseries.dbs_notifications(user_id,title,body,kind,link) select f.user_id,'Yeni bölüm yayında',episode.title,'new_episode','?episode='||episode.id from drabornseries.dbs_favorites f left join drabornseries.dbs_notification_preferences p on p.user_id=f.user_id where f.series_id=episode.series_id and coalesce(p.new_episodes,true);
 published_count:=published_count+1;
 end loop;
 return published_count;
end $$;
revoke all on function dbs_series_private.dbs_publish_due() from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_publish_due() to service_role;
select cron.schedule('dbs_series_publish_due','* * * * *','select dbs_series_private.dbs_publish_due()');
notify pgrst,'reload schema';
