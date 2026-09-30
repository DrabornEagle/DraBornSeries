-- Fixture-only tests. Every write, including Auth fixtures, rolls back.
begin;
set local statement_timeout='30s';
select set_config('dbs.test_user',gen_random_uuid()::text,true);
select set_config('dbs.test_session',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values(current_setting('dbs.test_user')::uuid,'authenticated','authenticated','dbs-r2-long-google-address-'||current_setting('dbs.test_user')||'@example.invalid',now(),'{"provider":"google","providers":["google"]}',
  '{"name":"Google fixture","avatar_url":"https://lh3.googleusercontent.com/a/fixture"}',now(),now());
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
values(gen_random_uuid(),current_setting('dbs.test_user')::uuid,current_setting('dbs.test_user'),jsonb_build_object('sub',current_setting('dbs.test_user')),'google',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('dbs.test_session')::uuid,current_setting('dbs.test_user')::uuid,now(),now());
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dbs.test_user'),'role','authenticated','session_id',current_setting('dbs.test_session'))::text,true);
set local role authenticated;
select drabornseries.dbs_bootstrap('r2-test','R2 transaction test','test');
do $$ begin
  if not exists(select 1 from drabornseries.dbs_profiles where user_id=auth.uid() and username='dbs-r2-long-google-address-'||auth.uid()||'@example.invalid' and avatar_url='https://lh3.googleusercontent.com/a/fixture' and full_name='Google fixture') then raise exception 'Google profile was not initialized'; end if;
  update drabornseries.dbs_profiles set username='custom_'||replace(auth.uid()::text,'-',''),avatar_url=null where user_id=auth.uid();
  perform drabornseries.dbs_bootstrap('r2-test','R2 transaction test','test');
  if not exists(select 1 from drabornseries.dbs_profiles where user_id=auth.uid() and username like 'custom_%' and avatar_url is null) then raise exception 'Google import overwrote user edits'; end if;
  begin
    perform drabornseries.dbs_studio_save_series(auth.uid(),'{}');
    raise exception 'Authenticated user obtained service-only transaction';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into drabornseries.dbs_admin_users(user_id,role) values(current_setting('dbs.test_user')::uuid,'editor');
set local role service_role;
select set_config('dbs.test_series',(drabornseries.dbs_studio_save_series(current_setting('dbs.test_user')::uuid,jsonb_build_object(
  'series',jsonb_build_object('slug','r2-fixture-'||current_setting('dbs.test_user'),'title','R2 fixture','status','published','video_orientation','portrait'),
  'episodes',jsonb_build_array(jsonb_build_object('number',1,'title','Free fixture','r2_key','Fixture/01.mp4','duration_seconds',20,'access_type','free','status','published'),
    jsonb_build_object('number',2,'title','Paid fixture','r2_key','Fixture/02.mp4','duration_seconds',25,'access_type','coins','coin_price',10,'status','published')))) ->>'id'),true);
do $$ declare result uuid; begin
  if (select count(*) from drabornseries.dbs_episodes where series_id=current_setting('dbs.test_series')::uuid)<>2 then raise exception 'Atomic episode import failed'; end if;
  update drabornseries.dbs_series set video_orientation='landscape' where id=current_setting('dbs.test_series')::uuid;
  if exists(select 1 from drabornseries.dbs_episodes where series_id=current_setting('dbs.test_series')::uuid and orientation<>'landscape') then raise exception 'Series direction did not propagate'; end if;
  update drabornseries.dbs_episodes set orientation='portrait' where series_id=current_setting('dbs.test_series')::uuid;
  if exists(select 1 from drabornseries.dbs_episodes where series_id=current_setting('dbs.test_series')::uuid and orientation<>'landscape') then raise exception 'Episode direction bypassed series setting'; end if;
  -- A conflicting new object never replaces an existing playable episode.
  begin
    perform drabornseries.dbs_studio_save_series(current_setting('dbs.test_user')::uuid,jsonb_build_object('series',jsonb_build_object('id',current_setting('dbs.test_series'),'slug','r2-fixture-'||current_setting('dbs.test_user'),'title','Conflicting title','video_orientation','portrait'),
      'episodes',jsonb_build_array(jsonb_build_object('number',1,'title','Replacement','r2_key','Fixture/wrong.mp4'))));
    raise exception 'Duplicate episode silently replaced media';
  exception when others then if sqlerrm<>'DUPLICATE_EPISODE' then raise; end if; end;
  if not exists(select 1 from drabornseries.dbs_series where id=current_setting('dbs.test_series')::uuid and title='R2 fixture' and video_orientation='landscape') then raise exception 'Failed batch partially changed series'; end if;
  -- Invalid duration rolls the entire new-series transaction back.
  begin
    perform drabornseries.dbs_studio_save_series(current_setting('dbs.test_user')::uuid,jsonb_build_object('series',jsonb_build_object('slug','r2-invalid-'||current_setting('dbs.test_user'),'title','Invalid fixture','video_orientation','portrait'),
      'episodes',jsonb_build_array(jsonb_build_object('number',1,'title','Invalid','r2_key','Fixture/invalid.mp4','duration_seconds',0))));
    raise exception 'Invalid duration was accepted';
  exception when check_violation then null; end;
  if exists(select 1 from drabornseries.dbs_series where slug='r2-invalid-'||current_setting('dbs.test_user')) then raise exception 'Failed batch left a partial series'; end if;
  select id into result from drabornseries.dbs_episodes where series_id=current_setting('dbs.test_series')::uuid and number=1;
  perform drabornseries.dbs_studio_save_series(current_setting('dbs.test_user')::uuid,jsonb_build_object('series',jsonb_build_object('id',current_setting('dbs.test_series'),'slug','r2-fixture-'||current_setting('dbs.test_user'),'title','R2 fixture','video_orientation','landscape'),
    'episodes',jsonb_build_array(jsonb_build_object('id',result,'number',1,'title','Renamed fixture','season_number',2))));
  if not exists(select 1 from drabornseries.dbs_episodes e join drabornseries.dbs_seasons s on s.id=e.season_id where e.id=result and e.title='Renamed fixture' and s.number=2) then raise exception 'Existing episode editor failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare episode uuid; begin
  select id into episode from drabornseries.dbs_episodes where series_id=current_setting('dbs.test_series')::uuid and number=1;
  if drabornseries.dbs_r2_playback_key(episode)<>'Fixture/01.mp4' then raise exception 'Free R2 guest playback failed'; end if;
  select id into episode from drabornseries.dbs_episodes where series_id=current_setting('dbs.test_series')::uuid and number=2;
  begin perform drabornseries.dbs_r2_playback_key(episode); raise exception 'Paid R2 key exposed to guest';
  exception when others then if sqlerrm<>'ACCESS_DENIED' then raise; end if; end;
  begin perform r2_key from drabornseries.dbs_video_assets; raise exception 'Private media table exposed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'R2 atomic import, entitlement, series direction and Google profile tests passed' as result;
