-- Isolated temporary accounts and purchases. Nothing survives rollback.
begin;
set local statement_timeout='30s';
select set_config('dbs.coin_user',gen_random_uuid()::text,true);
select set_config('dbs.coin_other',gen_random_uuid()::text,true);
select set_config('dbs.coin_token',encode(sha256(gen_random_uuid()::text::bytea),'hex'),true);
select set_config('dbs.coin_partial',encode(sha256(gen_random_uuid()::text::bytea),'hex'),true);
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id::uuid,'authenticated','authenticated','v075-'||id||'@example.invalid',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from (values(current_setting('dbs.coin_user')),(current_setting('dbs.coin_other'))) u(id);
insert into drabornseries.dbs_profiles(user_id,username)
select id::uuid,'v075_'||replace(id,'-','') from (values(current_setting('dbs.coin_user')),(current_setting('dbs.coin_other'))) u(id);
insert into drabornseries.dbs_borncoins_wallet(user_id)
select id::uuid from (values(current_setting('dbs.coin_user')),(current_setting('dbs.coin_other'))) u(id);
set local role authenticated;
do $$ declare denied boolean; begin
 denied:=false; begin perform drabornseries.dbs_apply_verified_purchase(current_setting('dbs.coin_user')::uuid,'dbs_coins_50',current_setting('dbs.coin_token'),null,'verified',null,'{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client minted currency'; end if;
 denied:=false; begin perform drabornseries.dbs_refund_play_coins(current_setting('dbs.coin_token')); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client reversed a purchase'; end if;
 denied:=false; begin perform 1 from drabornseries.dbs_purchase_receipts; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client read receipts'; end if;
end $$;
reset role;
set local role service_role;
do $$ declare account uuid:=current_setting('dbs.coin_user')::uuid; token text:=current_setting('dbs.coin_token'); receipt jsonb; result jsonb; denied boolean; other uuid:=current_setting('dbs.coin_other')::uuid; begin
 receipt:=jsonb_build_object('purchaseState',0,'quantity',1,'productId','dbs_coins_50','obfuscatedExternalAccountId',encode(sha256(account::text::bytea),'hex'));
 result:=drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_50',token,'fixture-order','verified',null,receipt);
 result:=drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_50',token,'fixture-order','verified',null,receipt);
 if not (result->>'duplicate')::boolean or (select balance from drabornseries.dbs_borncoins_wallet where user_id=account)<>50 then raise exception 'Coin replay credited twice'; end if;
 if (select count(*) from drabornseries.dbs_purchases where user_id=account)<>1 then raise exception 'Duplicate purchase'; end if;
 denied:=false; begin perform drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_100',token,null,'verified',null,receipt); exception when others then if sqlerrm='INVALID_COIN_RECEIPT' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Wrong product accepted'; end if;
 denied:=false; begin perform drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_50',encode(sha256(gen_random_uuid()::text::bytea),'hex'),null,'verified',null,receipt||'{"purchaseState":2}'); exception when others then if sqlerrm='INVALID_COIN_RECEIPT' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Pending payment credited'; end if;
 denied:=false; begin perform drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_50',encode(sha256(gen_random_uuid()::text::bytea),'hex'),null,'verified',null,receipt||'{"quantity":2}'); exception when others then if sqlerrm='INVALID_COIN_RECEIPT' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Multi-quantity minted extra coins'; end if;
 denied:=false; begin perform drabornseries.dbs_apply_verified_purchase(other,'dbs_coins_50',token,null,'verified',null,receipt); exception when others then if sqlerrm='INVALID_COIN_RECEIPT' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Foreign account accepted'; end if;
 denied:=false; begin perform drabornseries.dbs_apply_verified_purchase(other,'dbs_coins_50',token,null,'verified',null,receipt||jsonb_build_object('obfuscatedExternalAccountId',encode(sha256(other::text::bytea),'hex'))); exception when others then if sqlerrm='TOKEN_ALREADY_USED' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Token reused by another account'; end if;
 perform drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_100',encode(sha256(gen_random_uuid()::text::bytea),'hex'),null,'verified',null,receipt||'{"productId":"dbs_coins_100"}');
 if (select balance from drabornseries.dbs_borncoins_wallet where user_id=account)<>160 then raise exception 'Bonus total not credited'; end if;
 result:=drabornseries.dbs_refund_play_coins(token);
 if (result->>'reversed')::integer<>50 or (select balance from drabornseries.dbs_borncoins_wallet where user_id=account)<>110 then raise exception 'Refund did not reverse full unused purchase'; end if;
 result:=drabornseries.dbs_refund_play_coins(token);
 if not (result->>'duplicate')::boolean or (select balance from drabornseries.dbs_borncoins_wallet where user_id=account)<>110 then raise exception 'Refund replay changed balance'; end if;
 denied:=false; begin perform drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_50',token,null,'verified',null,receipt); exception when others then if sqlerrm='PURCHASE_REFUNDED' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Refunded purchase restored currency'; end if;
 perform drabornseries.dbs_apply_verified_purchase(account,'dbs_coins_50',current_setting('dbs.coin_partial'),null,'verified',null,receipt);
end $$;
reset role;
select dbs_series_private.dbs_ledger(current_setting('dbs.coin_user')::uuid,-140,'test_spend','fixture:'||current_setting('dbs.coin_partial'),'Isolated refund fixture');
set local role service_role;
do $$ declare result jsonb; begin
 result:=drabornseries.dbs_refund_play_coins(current_setting('dbs.coin_partial'));
 if (result->>'reversed')::integer<>20 or not (result->>'reviewRequired')::boolean or (select balance from drabornseries.dbs_borncoins_wallet where user_id=current_setting('dbs.coin_user')::uuid)<>0 then raise exception 'Spent refund was not limited and audited'; end if;
end $$;
reset role;
rollback;
select 'v075 coin purchase, bonus, replay, account, pending, privilege and refund tests passed' as result;
