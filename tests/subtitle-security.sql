-- Playback resolves captions after entitlement checks; direct viewer writes stay denied.
begin;
set local statement_timeout='30s';
do $$ declare v_episode uuid; v_id uuid; v_count integer; begin
 if not (select relrowsecurity from pg_class where oid='drabornseries.dbs_subtitles'::regclass) then
  raise exception 'Subtitle RLS disabled';
 end if;
 if not exists(select 1 from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
  where a.attrelid='drabornseries.dbs_episodes'::regclass and a.attname='orientation'
  and pg_get_expr(d.adbin,d.adrelid)='''portrait''::text') then
  raise exception 'New episodes do not default to portrait';
 end if;
 select t.episode_id,t.id into v_episode,v_id from drabornseries.dbs_subtitles t
 join drabornseries.dbs_episodes e on e.id=t.episode_id
 join drabornseries.dbs_series s on s.id=e.series_id where s.slug='sintel' and t.language='tr';
 if v_episode is null then raise exception 'Curated Turkish subtitles missing'; end if;
 select count(*) into v_count from drabornseries.dbs_subtitles;
 insert into drabornseries.dbs_subtitles(episode_id,language,label,asset_key)
 values(v_episode,'tr','Türkçe test','https://example.invalid/test.vtt')
 on conflict(episode_id,language) do update set label=excluded.label;
 if (select count(*) from drabornseries.dbs_subtitles)<>v_count or
    (select id from drabornseries.dbs_subtitles where episode_id=v_episode and language='tr')<>v_id then
  raise exception 'Subtitle upsert duplicated or replaced identity';
 end if;
end $$;
set local role anon;
do $$ declare denied boolean:=false; begin
 begin insert into drabornseries.dbs_subtitles(language,label,asset_key) values('tr','Unauthorized','https://example.invalid/test.vtt');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous subtitle write allowed'; end if;
end $$;
reset role;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin insert into drabornseries.dbs_subtitles(language,label,asset_key) values('tr','Unauthorized','https://example.invalid/test.vtt');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Viewer subtitle write allowed'; end if;
end $$;
reset role;
rollback;
