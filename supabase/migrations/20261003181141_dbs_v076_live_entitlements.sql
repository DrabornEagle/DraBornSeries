-- Only the signed-in user's RLS-protected entitlement changes are delivered.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='drabornseries' and tablename='dbs_borncoins_wallet') then
  alter publication supabase_realtime add table drabornseries.dbs_borncoins_wallet;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='drabornseries' and tablename='dbs_vip_subscriptions') then
  alter publication supabase_realtime add table drabornseries.dbs_vip_subscriptions;
 end if;
end $$;
