create or replace function dbs_series_private.dbs_delete_account() returns void language plpgsql security definer set search_path='' as $$
declare item record;
begin
 if not dbs_series_private.dbs_active() then raise exception 'AUTH_REQUIRED'; end if;
 -- Unlocks reference ledger transactions; remove these children before ledger rows.
 delete from drabornseries.dbs_episode_unlocks where user_id=auth.uid();
 for item in select table_name from information_schema.columns where table_schema='drabornseries' and column_name='user_id' and table_name<>'dbs_profiles' loop
 execute format('delete from drabornseries.%I where user_id=$1',item.table_name) using auth.uid();
 end loop;
 update drabornseries.dbs_profiles set username='deleted_'||replace(auth.uid()::text,'-',''),full_name=null,avatar_url=null,birth_date=null,preferences='{}',status='deleted' where user_id=auth.uid();
end $$;
notify pgrst,'reload schema';
