-- Only verified, single-quantity coin receipts can create currency; refunds cannot be replayed.
create or replace function dbs_series_private.dbs_apply_verified_purchase(account uuid,product text,token_hash text,order_id text,subscription_status text,expires_at timestamptz,receipt jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item drabornseries.dbs_google_play_products; prior drabornseries.dbs_purchases; purchase_id uuid;
begin
 if token_hash !~ '^[a-f0-9]{64}$' or coalesce((receipt->>'purchaseState')::integer,-1)<>0
   or coalesce((receipt->>'quantity')::integer,1)<>1
   or receipt->>'obfuscatedExternalAccountId' is distinct from encode(sha256(convert_to(account::text,'UTF8')),'hex')
   or (receipt ? 'productId' and receipt->>'productId' is distinct from product) then raise exception 'INVALID_COIN_RECEIPT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(token_hash,0));
 select * into item from drabornseries.dbs_google_play_products p where p.id=product and p.active and p.kind='coins';
 if item.id is null or item.coins<=0 then raise exception 'PRODUCT_INACTIVE'; end if;
 perform 1 from drabornseries.dbs_borncoins_wallet where user_id=account for update;
 if not found or not exists(select 1 from drabornseries.dbs_profiles where user_id=account and status='active') then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into prior from drabornseries.dbs_purchases p where p.token_hash=dbs_apply_verified_purchase.token_hash;
 if prior.id is not null and (prior.user_id<>account or prior.product_id<>product) then raise exception 'TOKEN_ALREADY_USED'; end if;
 if prior.status='refunded' then raise exception 'PURCHASE_REFUNDED'; end if;
 if prior.id is null then
   insert into drabornseries.dbs_purchases(user_id,product_id,token_hash,order_id,status) values(account,product,token_hash,order_id,'verified') returning id into purchase_id;
   insert into drabornseries.dbs_purchase_receipts(purchase_id,receipt) values(purchase_id,receipt-'purchaseToken');
 else purchase_id:=prior.id; end if;
 perform dbs_series_private.dbs_ledger(account,item.coins,'purchase','google:'||token_hash,'Google Play BornCoins');
 return jsonb_build_object('purchase_id',purchase_id,'duplicate',prior.id is not null,'coins',item.coins);
end $$;

-- Authenticated Google RTDN can reverse an unspent coin balance once. Spent portions stay auditable.
create function dbs_series_private.dbs_refund_play_coins(token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior drabornseries.dbs_purchases; amount bigint; balance bigint; reversed bigint;
begin
 if token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_PURCHASE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(token_hash,0));
 select * into prior from drabornseries.dbs_purchases p where p.token_hash=dbs_refund_play_coins.token_hash;
 if prior.id is null then raise exception 'PURCHASE_NOT_FOUND'; end if;
 if not exists(select 1 from drabornseries.dbs_google_play_products p where p.id=prior.product_id and p.kind='coins') then raise exception 'INVALID_PRODUCT'; end if;
 if prior.status='refunded' then return jsonb_build_object('duplicate',true); end if;
 select w.balance into balance from drabornseries.dbs_borncoins_wallet w where w.user_id=prior.user_id for update;
 select t.amount into amount from drabornseries.dbs_borncoins_transactions t where t.reference='google:'||token_hash and t.user_id=prior.user_id;
 if amount is null or balance is null then raise exception 'PURCHASE_NOT_CREDITED'; end if;
 reversed:=least(amount,balance);
 if reversed>0 then perform dbs_series_private.dbs_ledger(prior.user_id,-reversed,'refund','google-refund:'||token_hash,'Google Play BornCoins iadesi'); end if;
 update drabornseries.dbs_purchases p set status='refunded' where p.id=prior.id;
 update drabornseries.dbs_purchase_receipts r set receipt=r.receipt||jsonb_build_object('coinRefund',jsonb_build_object('reversed',reversed,'spent',amount-reversed,'reviewRequired',amount>reversed,'at',now())) where r.purchase_id=prior.id;
 return jsonb_build_object('duplicate',false,'reversed',reversed,'reviewRequired',amount>reversed);
end $$;
create function drabornseries.dbs_refund_play_coins(token_hash text) returns jsonb language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_refund_play_coins(token_hash) $$;
revoke all on function drabornseries.dbs_refund_play_coins(text),dbs_series_private.dbs_refund_play_coins(text) from public,anon,authenticated;
grant execute on function drabornseries.dbs_refund_play_coins(text),dbs_series_private.dbs_refund_play_coins(text) to service_role;
notify pgrst,'reload schema';
