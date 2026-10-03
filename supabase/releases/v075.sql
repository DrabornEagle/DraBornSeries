-- v0.7.5 / Android code 2: only DraBornSeries release metadata and known product switches.
begin;
insert into drabornseries.dbs_app_config(key,value,is_public)
values ('release','{"version":"0.7.5","versionCode":2,"stage":"release_validation","adsPlatform":"android"}'::jsonb,true)
on conflict(key) do update set value=excluded.value,is_public=excluded.is_public;
update drabornseries.dbs_google_play_products set active=true where id in
 ('dbs_vip_weekly','dbs_vip_monthly','dbs_vip_yearly','dbs_coins_50','dbs_coins_100','dbs_coins_250','dbs_coins_500','dbs_coins_1000','dbs_coins_2500');
commit;
