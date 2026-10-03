-- v0.7.7 / Android code 4: release metadata only; customer balances and subscriptions are unchanged.
begin;
insert into drabornseries.dbs_app_settings(key,value,public)
values ('release','{"version":"0.7.7","versionCode":4,"stage":"closed_test","adsPlatform":"android"}'::jsonb,true)
on conflict(key) do update set value=excluded.value,public=excluded.public;
commit;
