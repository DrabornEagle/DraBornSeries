-- Temporary owner-authorized links bridge an older Worker while its API-key support is updated.
alter table drabornseries.dbs_auto_subtitle_jobs add column preview_url text, add column preview_until timestamptz;
