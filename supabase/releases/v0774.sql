-- v0.7.7.4 / Android code 7. 6 October revision: restored-tab version checks and requested privacy/support text.
begin;
insert into drabornseries.dbs_app_settings(key,value,public)
values ('release','{"version":"0.7.7.4","versionCode":7,"stage":"closed_test","adsPlatform":"android"}'::jsonb,true)
on conflict(key) do update set value=excluded.value,public=excluded.public;
commit;
