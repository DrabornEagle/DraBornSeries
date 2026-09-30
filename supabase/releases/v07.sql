-- Idempotent release metadata; no DDL or changes to another app's schema.
insert into drabornseries.dbs_app_settings(key,value,public)
values ('release','{"version":"0.7.0","versionCode":1,"stage":"expo_go_test"}'::jsonb,true)
on conflict(key) do update set value=excluded.value,public=excluded.public;
insert into drabornseries.dbs_app_settings(key,value,public)
values ('legal','{"privacy":"https://www.draborneagle.com/DraBornSeries/privacy.html","accountDeletion":"https://www.draborneagle.com/DraBornSeries/account-deletion.html","terms":"https://www.draborneagle.com/DraBornSeries/terms.html","contact":"draborneagle@gmail.com","updated":"2026-09-30"}'::jsonb,true)
on conflict(key) do update set value=excluded.value,public=excluded.public;
