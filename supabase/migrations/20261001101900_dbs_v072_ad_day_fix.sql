create or replace function dbs_series_private.dbs_complete_ad(ticket uuid,account uuid,transaction text,ad_unit text,earned_at timestamptz) returns jsonb
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
