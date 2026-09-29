-- Temporary identities and Storage rows; everything rolls back.
begin;
set local statement_timeout='30s';
select set_config('dbs.test_user',gen_random_uuid()::text,true);
select set_config('dbs.test_session',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,created_at,updated_at)
values(current_setting('dbs.test_user')::uuid,'authenticated','authenticated','dbs-media-'||current_setting('dbs.test_user')||'@example.invalid',now(),
 jsonb_build_object('role','owner','dbs_registration',jsonb_build_object('username','dbs_'||replace(current_setting('dbs.test_user'),'-',''),'full_name','Kayıt Testi')), '{}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('dbs.test_session')::uuid,current_setting('dbs.test_user')::uuid,now(),now());
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('dbs.test_user'),'role','authenticated','session_id',current_setting('dbs.test_session'))::text,true);
set local role authenticated;
select drabornseries.dbs_bootstrap('media-test-device','Media upload test','test');
do $$ declare denied boolean:=false; begin
 if drabornseries.dbs_is_admin() then raise exception 'Auth metadata granted admin'; end if;
 if not exists(select 1 from drabornseries.dbs_profiles where user_id=auth.uid() and full_name='Kayıt Testi' and username='dbs_'||replace(auth.uid()::text,'-','')) then raise exception 'Signup display fields not initialized'; end if;
 update drabornseries.dbs_profiles set full_name='Güncel Profil' where user_id=auth.uid();
 perform drabornseries.dbs_bootstrap('media-test-device','Repeated login','test');
 if not exists(select 1 from drabornseries.dbs_profiles where user_id=auth.uid() and full_name='Güncel Profil') then raise exception 'Registration overwrote edited profile'; end if;
 begin insert into storage.objects(bucket_id,name,owner_id) values('dbs_series_artwork',auth.uid()::text||'/fixture.jpg',auth.uid()::text); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Viewer uploaded artwork'; end if;
end $$;
reset role;
insert into drabornseries.dbs_admin_users(user_id,role) values(current_setting('dbs.test_user')::uuid,'support');
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin insert into storage.objects(bucket_id,name,owner_id) values('dbs_series_artwork',auth.uid()::text||'/fixture.jpg',auth.uid()::text); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Support uploaded artwork'; end if;
end $$;
reset role;
update drabornseries.dbs_admin_users set role='editor' where user_id=current_setting('dbs.test_user')::uuid;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 insert into storage.objects(bucket_id,name,owner_id) values('dbs_series_artwork',auth.uid()::text||'/fixture.jpg',auth.uid()::text);
 begin insert into storage.objects(bucket_id,name,owner_id) values('dbs_series_artwork',gen_random_uuid()::text||'/fixture.jpg',auth.uid()::text); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Editor uploaded to foreign folder'; end if;
 denied:=false;
 begin update storage.objects set name=gen_random_uuid()::text||'/fixture.jpg' where bucket_id='dbs_series_artwork' and name=auth.uid()::text||'/fixture.jpg'; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Editor reassigned file to foreign folder'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='dbs_series_artwork' and name=current_setting('dbs.test_user')||'/fixture.jpg') then raise exception 'Public artwork not readable'; end if;
end $$;
reset role;
set local role authenticated;
select drabornseries.dbs_revoke_session(current_setting('dbs.test_session')::uuid);
do $$ declare denied boolean:=false; begin
 if drabornseries.dbs_is_admin() then raise exception 'Revoked session retained editor rights'; end if;
 begin insert into storage.objects(bucket_id,name,owner_id) values('dbs_series_artwork',auth.uid()::text||'/blocked.jpg',auth.uid()::text); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked session uploaded media'; end if;
end $$;
reset role;
rollback;
