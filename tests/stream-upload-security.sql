-- Test only temporary identities/content; all changes roll back.
begin;
set local statement_timeout='30s';
select set_config('dbs.test_user',gen_random_uuid()::text,true);
select set_config('dbs.test_series',gen_random_uuid()::text,true);
select set_config('dbs.test_episode',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,raw_app_meta_data,created_at,updated_at)
values(current_setting('dbs.test_user')::uuid,'authenticated','authenticated','dbs-stream-'||current_setting('dbs.test_user')||'@example.invalid','{}','{}',now(),now());
insert into drabornseries.dbs_series(id,slug,title,status) values(current_setting('dbs.test_series')::uuid,'stream-test-'||current_setting('dbs.test_series'),'Stream test','draft');
insert into drabornseries.dbs_episodes(id,series_id,number,title,orientation,status)
values(current_setting('dbs.test_episode')::uuid,current_setting('dbs.test_series')::uuid,1,'Test','landscape','draft');
insert into drabornseries.dbs_video_uploads(uid,episode_id,created_by,purpose,status,created_at)
select repeat('a',32),current_setting('dbs.test_episode')::uuid,current_setting('dbs.test_user')::uuid,'episode','processing',now()-interval '3 minutes';
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform * from drabornseries.dbs_video_uploads; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client read upload tracking'; end if;
 denied:=false;
 begin perform drabornseries.dbs_complete_stream_upload(repeat('a',32),'{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client could bind a UID'; end if;
end $$;
reset role;
set local role service_role;
do $$ declare denied boolean:=false; begin
 begin perform drabornseries.dbs_complete_stream_upload(repeat('a',32),jsonb_build_object('uid',repeat('a',32),'readyToStream',true,'requireSignedURLs',false)); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Public episode accepted'; end if;
 if drabornseries.dbs_complete_stream_upload(repeat('a',32),jsonb_build_object('uid',repeat('a',32),'readyToStream',false)) then raise exception 'Processing video became ready'; end if;
 if not drabornseries.dbs_complete_stream_upload(repeat('a',32),jsonb_build_object('uid',repeat('a',32),'readyToStream',true,'requireSignedURLs',true,'duration',12.4,'input',jsonb_build_object('width',720,'height',1280))) then raise exception 'Ready video was not bound'; end if;
 if not exists(select 1 from drabornseries.dbs_episodes where id=current_setting('dbs.test_episode')::uuid and duration_seconds=13 and orientation='landscape') then raise exception 'Duration or selected orientation changed incorrectly'; end if;
end $$;
insert into drabornseries.dbs_video_uploads(uid,episode_id,created_by,purpose,status,created_at)
select repeat('b',32),current_setting('dbs.test_episode')::uuid,current_setting('dbs.test_user')::uuid,'episode','processing',now()-interval '2 minutes'
union all select repeat('c',32),current_setting('dbs.test_episode')::uuid,current_setting('dbs.test_user')::uuid,'episode','processing',now()-interval '1 minute';
do $$ begin
 if drabornseries.dbs_complete_stream_upload(repeat('b',32),jsonb_build_object('uid',repeat('b',32),'readyToStream',true,'requireSignedURLs',true)) then raise exception 'Older callback replaced newer selection'; end if;
 perform drabornseries.dbs_complete_stream_upload(repeat('c',32),jsonb_build_object('uid',repeat('c',32),'readyToStream',false,'status',jsonb_build_object('state','error','errReasonCode','ERR_MALFORMED_VIDEO')));
 if not exists(select 1 from drabornseries.dbs_video_assets where episode_id=current_setting('dbs.test_episode')::uuid and stream_uid=repeat('a',32) and ready) then raise exception 'Failed replacement removed playable video'; end if;
 if not exists(select 1 from drabornseries.dbs_video_uploads where uid=repeat('c',32) and error_code='ERR_MALFORMED_VIDEO') then raise exception 'Encoding failure not recorded'; end if;
 if not drabornseries.dbs_complete_stream_upload(repeat('a',32),jsonb_build_object('uid',repeat('a',32),'readyToStream',true,'requireSignedURLs',true)) then raise exception 'Repeated callback was not idempotent'; end if;
end $$;
reset role;
rollback;
