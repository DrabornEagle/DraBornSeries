-- DraBornSeries release marker only; do not change other applications' settings.
update drabornseries.dbs_app_settings
   set value = jsonb_set(value, '{version}', '"0.3.0"'::jsonb, true)
 where key = 'release' and value->>'version' = '0.2.0';
