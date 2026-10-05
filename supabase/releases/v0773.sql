-- v0.7.7.3 / Android code 6. Atomic wallet filters, padded actions and compact mobile header.
begin;
insert into drabornseries.dbs_app_settings(key,value,public)
values ('release','{"version":"0.7.7.3","versionCode":6,"stage":"closed_test","adsPlatform":"android"}'::jsonb,true)
on conflict(key) do update set value=excluded.value,public=excluded.public;
commit;
