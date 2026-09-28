create function dbs_series_private.dbs_admin_grant(account uuid, coins integer, reason text, request_id uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare balance bigint;
begin
 if not dbs_series_private.dbs_admin() or not exists(select 1 from drabornseries.dbs_admin_users where user_id=auth.uid() and role='owner') then raise exception 'ADMIN_REQUIRED'; end if;
 if coins<1 or coins>100000 or length(trim(reason))<5 then raise exception 'INVALID_GRANT'; end if;
 perform dbs_series_private.dbs_ledger(account,coins,'admin','admin:'||request_id,reason);
 insert into drabornseries.dbs_admin_logs(admin_id,action,target,detail) values(auth.uid(),'coin_grant',account::text,jsonb_build_object('coins',coins,'reason',reason,'request_id',request_id));
 select w.balance into balance from drabornseries.dbs_borncoins_wallet w where user_id=account;
 return balance;
end $$;
create function drabornseries.dbs_admin_grant(account uuid,coins integer,reason text,request_id uuid) returns bigint language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_admin_grant(account,coins,reason,request_id) $$;
create function dbs_series_private.dbs_delete_account() returns void language plpgsql security definer set search_path='' as $$
declare item record;
begin
 if not dbs_series_private.dbs_active() then raise exception 'AUTH_REQUIRED'; end if;
 for item in select table_name from information_schema.columns where table_schema='drabornseries' and column_name='user_id' and table_name<>'dbs_profiles' loop
 execute format('delete from drabornseries.%I where user_id=$1',item.table_name) using auth.uid();
 end loop;
 update drabornseries.dbs_profiles set username='deleted_'||replace(auth.uid()::text,'-',''),full_name=null,avatar_url=null,birth_date=null,preferences='{}',status='deleted' where user_id=auth.uid();
end $$;
create function drabornseries.dbs_delete_account() returns void language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_delete_account() $$;
revoke all on function dbs_series_private.dbs_admin_grant(uuid,integer,text,uuid),drabornseries.dbs_admin_grant(uuid,integer,text,uuid),dbs_series_private.dbs_delete_account(),drabornseries.dbs_delete_account() from public,anon;
grant execute on function dbs_series_private.dbs_admin_grant(uuid,integer,text,uuid),drabornseries.dbs_admin_grant(uuid,integer,text,uuid),dbs_series_private.dbs_delete_account(),drabornseries.dbs_delete_account() to authenticated;
-- Verified owner only. Does not assign privileges from user-editable metadata.
insert into drabornseries.dbs_profiles(user_id,username) select id,'draborneagle_'||left(id::text,8) from auth.users where lower(email)='draborneagle@gmail.com' and email_confirmed_at is not null on conflict do nothing;
insert into drabornseries.dbs_admin_users(user_id,role) select p.user_id,'owner' from drabornseries.dbs_profiles p join auth.users u on u.id=p.user_id where lower(u.email)='draborneagle@gmail.com' and u.email_confirmed_at is not null on conflict do nothing;
notify pgrst,'reload schema';
