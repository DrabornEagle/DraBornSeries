-- v0.7.7 / Android code 4: release metadata and known product switches; customer balances and subscriptions are unchanged.
begin;
insert into drabornseries.dbs_app_settings(key,value,public)
values ('release','{"version":"0.7.7","versionCode":4,"stage":"closed_test","adsPlatform":"android"}'::jsonb,true)
on conflict(key) do update set value=excluded.value,public=excluded.public;
update drabornseries.dbs_google_play_products set active=true where id in
 ('dbs_vip_weekly','dbs_vip_monthly','dbs_vip_yearly','dbs_coins_50','dbs_coins_100','dbs_coins_250','dbs_coins_500','dbs_coins_1000','dbs_coins_2500');
commit;
