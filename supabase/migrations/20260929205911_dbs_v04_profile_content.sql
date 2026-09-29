-- DraBornSeries only: shared Auth/Storage remain isolated by bucket and ownership.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dbs_series_avatars','dbs_series_avatars',true,2097152,array['image/jpeg'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy dbs_avatar_read on storage.objects for select to anon,authenticated
using(bucket_id='dbs_series_avatars');
create policy dbs_avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='dbs_series_avatars' and name=(select auth.uid())::text||'/avatar.jpg' and (select dbs_series_private.dbs_active()));
create policy dbs_avatar_update on storage.objects for update to authenticated
using(bucket_id='dbs_series_avatars' and name=(select auth.uid())::text||'/avatar.jpg' and (select dbs_series_private.dbs_active()))
with check(bucket_id='dbs_series_avatars' and name=(select auth.uid())::text||'/avatar.jpg' and (select dbs_series_private.dbs_active()));
create policy dbs_avatar_delete on storage.objects for delete to authenticated
using(bucket_id='dbs_series_avatars' and name=(select auth.uid())::text||'/avatar.jpg' and (select dbs_series_private.dbs_active()));

create function dbs_series_private.dbs_admin_delete_series(series uuid, confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target drabornseries.dbs_series; episode_count integer; snapshot jsonb;
begin
  if not dbs_series_private.dbs_admin() or not exists(
    select 1 from drabornseries.dbs_admin_users where user_id=auth.uid() and role='owner') then
    raise exception 'OWNER_REQUIRED';
  end if;
  select * into target from drabornseries.dbs_series s where s.id=series for update;
  if target.id is null then return jsonb_build_object('deleted',false,'already_deleted',true); end if;
  if confirmation is distinct from target.title then raise exception 'CONFIRMATION_REQUIRED'; end if;
  select count(*) into episode_count from drabornseries.dbs_episodes where series_id=target.id;
  snapshot:=jsonb_build_object('id',target.id,'title',target.title,'slug',target.slug,
    'series',to_jsonb(target),'episodes',coalesce((select jsonb_agg(to_jsonb(e)) from drabornseries.dbs_episodes e where series_id=target.id),'[]'::jsonb),
    'unlocks',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'user_id',u.user_id,'episode_id',u.episode_id,'transaction_id',u.transaction_id,'source',u.source))
      from drabornseries.dbs_episode_unlocks u join drabornseries.dbs_episodes e on e.id=u.episode_id where e.series_id=target.id),'[]'::jsonb));
  -- Reports keep their original narrative and a readable reference to removed content.
  update drabornseries.dbs_content_reports r set series_id=null,episode_id=null,
    body=coalesce(r.body,'')||E'\nSilinen dizi: '||target.title||' ('||target.id||')'
    where r.series_id=target.id or r.episode_id in(select id from drabornseries.dbs_episodes where series_id=target.id);
  delete from drabornseries.dbs_series where id=target.id;
  insert into drabornseries.dbs_admin_logs(admin_id,action,target,detail)
    values(auth.uid(),'delete','dbs_series',snapshot);
  return jsonb_build_object('deleted',true,'episodes',episode_count);
end $$;
revoke all on function dbs_series_private.dbs_admin_delete_series(uuid,text) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_admin_delete_series(uuid,text) to authenticated;
create function drabornseries.dbs_admin_delete_series(series uuid, confirmation text)
returns jsonb language sql security invoker set search_path='' as $$
  select dbs_series_private.dbs_admin_delete_series(series,confirmation)
$$;
revoke all on function drabornseries.dbs_admin_delete_series(uuid,text) from public,anon,authenticated;
grant execute on function drabornseries.dbs_admin_delete_series(uuid,text) to authenticated;

-- Counters come from account activity, never from illustrative seed numbers.
create function dbs_series_private.dbs_series_like_count() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update drabornseries.dbs_series set like_count=greatest(0,like_count+case when tg_op='INSERT' then 1 else -1 end)
    where id=case when tg_op='INSERT' then new.series_id else old.series_id end;
  return null;
end $$;
revoke all on function dbs_series_private.dbs_series_like_count() from public,anon,authenticated;
create trigger dbs_series_like_counter after insert or delete on drabornseries.dbs_likes
for each row execute function dbs_series_private.dbs_series_like_count();
create function dbs_series_private.dbs_series_view_count() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.position_seconds>=least(5,new.duration_seconds/2) and
    (tg_op='INSERT' or old.position_seconds<least(5,new.duration_seconds/2)) then
    -- One counted play per account/episode. Backward seeking must not count again.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||new.episode_id::text,0));
    if not exists(select 1 from drabornseries.dbs_watch_history where user_id=new.user_id and episode_id=new.episode_id) then
      insert into drabornseries.dbs_watch_history(user_id,episode_id,watched_seconds,device_id)
        values(new.user_id,new.episode_id,new.position_seconds,new.device_id);
      update drabornseries.dbs_series set view_count=view_count+1
        where id=(select series_id from drabornseries.dbs_episodes where id=new.episode_id);
    end if;
  end if;
  return null;
end $$;
revoke all on function dbs_series_private.dbs_series_view_count() from public,anon,authenticated;
create index dbs_history_account_episode on drabornseries.dbs_watch_history(user_id,episode_id);
create trigger dbs_series_view_counter after insert or update on drabornseries.dbs_watch_progress
for each row execute function dbs_series_private.dbs_series_view_count();
update drabornseries.dbs_series s set like_count=(select count(*) from drabornseries.dbs_likes where series_id=s.id);

insert into drabornseries.dbs_app_settings(key,value)
values('release','{"version":"0.4.0","versionCode":1,"channel":"expo-go-web"}')
on conflict(key) do update set value=excluded.value;

-- Replace the legacy landscape and disconnected stock samples with original 9:16 micro-series.
-- Ledger/purchase records survive content removal; reports retain a named reference.
insert into drabornseries.dbs_admin_logs(action,target,detail)
select 'catalog_replace','dbs_series',jsonb_build_object('release','0.4.0','removed',jsonb_agg(jsonb_build_object('id',id,'slug',slug,'title',title)))
from drabornseries.dbs_series where is_demo and slug in ('big-buck-bunny','sintel','sehir-isiklari','geceye-bir-soz','kiyida-ikimiz','ayni-ritim') having count(*)>0;
update drabornseries.dbs_content_reports r set body=coalesce(r.body,'')||E'\nEski test içeriği v0.4 kataloğundan kaldırıldı.',series_id=null,episode_id=null
where r.series_id in(select id from drabornseries.dbs_series where is_demo and slug in ('big-buck-bunny','sintel','sehir-isiklari','geceye-bir-soz','kiyida-ikimiz','ayni-ritim'))
or r.episode_id in(select e.id from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.is_demo and s.slug in ('big-buck-bunny','sintel','sehir-isiklari','geceye-bir-soz','kiyida-ikimiz','ayni-ritim'));
delete from drabornseries.dbs_series where is_demo and slug in ('big-buck-bunny','sintel','sehir-isiklari','geceye-bir-soz','kiyida-ikimiz','ayni-ritim');
insert into drabornseries.dbs_series(slug,title,short_description,description,accent,poster_url,banner_url,license,genres,status,is_demo,featured_order,total_episodes,total_seasons,average_duration,production_year,age_rating,language,director) values('neon-postasi','Neon Postası','Bir teslimat. Bir şehir. Yeniden yanan bir ışık.','Bir teslimat. Bir şehir. Yeniden yanan bir ışık. DraBornSeries için hazırlanmış özgün vektör animasyon mini dizisi. Bölümler aynı hikâyeyi devam ettirir; Türkçe yazılar ve özgün müzik içerir. 9:16 erken erişim test içeriği; AI videosu değildir.','#ff5aa8','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/c2c3a746-9bf4-4f1d-9484-423e34db784f.jpg','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/c2c3a746-9bf4-4f1d-9484-423e34db784f.jpg','DraBornSeries original procedural animation, story and soundtrack. Test exhibition authorized by the project owner.',array['Animasyon','Macera'],'published',true,1,5,1,24,2026,'Genel','tr','DraBornSeries Stüdyo')
on conflict(slug) do update set title=excluded.title,short_description=excluded.short_description,description=excluded.description,accent=excluded.accent,poster_url=excluded.poster_url,banner_url=excluded.banner_url,license=excluded.license,genres=excluded.genres,status=excluded.status,is_demo=excluded.is_demo,featured_order=excluded.featured_order,total_episodes=excluded.total_episodes,average_duration=excluded.average_duration;
insert into drabornseries.dbs_seasons(series_id,number,title) select id,1,'Sezon 1' from drabornseries.dbs_series where slug='neon-postasi' on conflict do nothing;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,1,'Son Teslimat','Neon Postası · Son Teslimat · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/c2c3a746-9bf4-4f1d-9484-423e34db784f.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='neon-postasi' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/ba50ea49-2fa6-42a2-acd8-84309cc0c8ef.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='neon-postasi' and e.number=1 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,2,'Kayıp Sinyal','Neon Postası · Kayıp Sinyal · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/18854490-4194-4207-accd-625ec46ce13c.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='neon-postasi' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/ccaf0286-a5d7-49bb-aac5-73af8b4fc91e.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='neon-postasi' and e.number=2 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,3,'Fırtınanın İçinden','Neon Postası · Fırtınanın İçinden · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/340fa58d-c579-4090-b7f2-8d436c13ccbf.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='neon-postasi' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/e4b0cd3a-cb69-4d41-899e-c5f831f8c7d6.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='neon-postasi' and e.number=3 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,4,'Işığın Sırrı','Neon Postası · Işığın Sırrı · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/f5657765-8102-4f85-bdd7-ccb17d14eea7.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='neon-postasi' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/7c3ec94a-68d6-4043-9b07-d6724302f8d4.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='neon-postasi' and e.number=4 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,5,'Yeni Bir Şafak','Neon Postası · Yeni Bir Şafak · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/f1cf20b7-24f7-4cb5-8454-828b74917ae6.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='neon-postasi' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/21aa68b4-9a8f-45ed-ba6a-e9ecd5c5acde.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='neon-postasi' and e.number=5 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
insert into drabornseries.dbs_series(slug,title,short_description,description,accent,poster_url,banner_url,license,genres,status,is_demo,featured_order,total_episodes,total_seasons,average_duration,production_year,age_rating,language,director) values('yildiz-tohumu','Yıldız Tohumu','Küçük bir tohum, karanlık bir gökyüzünü değiştirebilir.','Küçük bir tohum, karanlık bir gökyüzünü değiştirebilir. DraBornSeries için hazırlanmış özgün vektör animasyon mini dizisi. Bölümler aynı hikâyeyi devam ettirir; Türkçe yazılar ve özgün müzik içerir. 9:16 erken erişim test içeriği; AI videosu değildir.','#7ee9ca','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/3c0c3802-0f87-4091-aeab-2aea73f86196.jpg','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/3c0c3802-0f87-4091-aeab-2aea73f86196.jpg','DraBornSeries original procedural animation, story and soundtrack. Test exhibition authorized by the project owner.',array['Animasyon','Fantastik'],'published',true,2,3,1,24,2026,'Genel','tr','DraBornSeries Stüdyo')
on conflict(slug) do update set title=excluded.title,short_description=excluded.short_description,description=excluded.description,accent=excluded.accent,poster_url=excluded.poster_url,banner_url=excluded.banner_url,license=excluded.license,genres=excluded.genres,status=excluded.status,is_demo=excluded.is_demo,featured_order=excluded.featured_order,total_episodes=excluded.total_episodes,average_duration=excluded.average_duration;
insert into drabornseries.dbs_seasons(series_id,number,title) select id,1,'Sezon 1' from drabornseries.dbs_series where slug='yildiz-tohumu' on conflict do nothing;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,1,'Gökyüzünden Gelen Çağrı','Yıldız Tohumu · Gökyüzünden Gelen Çağrı · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/3c0c3802-0f87-4091-aeab-2aea73f86196.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='yildiz-tohumu' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/f6c5a524-08ab-4594-9f66-b9b15ae14219.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='yildiz-tohumu' and e.number=1 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,2,'Karanlık Bahçe','Yıldız Tohumu · Karanlık Bahçe · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/dbe9517d-9f90-4c28-a75b-598b766d1f5e.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='yildiz-tohumu' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/3d3794a5-f8e7-4f9a-9f5a-afda33602703.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='yildiz-tohumu' and e.number=2 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
insert into drabornseries.dbs_episodes(series_id,season_id,number,title,description,duration_seconds,thumbnail_url,orientation,access_type,status,publish_at) select s.id,se.id,3,'Birlikte Parlıyoruz','Yıldız Tohumu · Birlikte Parlıyoruz · Özgün dikey animasyon.',24,'https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/07438359-951a-4309-beb8-b705dc469ff3.jpg','portrait','free','published',now() from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where s.slug='yildiz-tohumu' on conflict(series_id,number) do update set title=excluded.title,description=excluded.description,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,orientation=excluded.orientation,access_type=excluded.access_type,status=excluded.status;
insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready) select e.id,'demo','https://d2ol7oe51mr4n9.cloudfront.net/user_38eJOo5S2qdRoP5Q1BXMOZD5Qig/1a944ffc-b25f-4575-bc6f-64787d039268.mp4',true from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where s.slug='yildiz-tohumu' and e.number=3 on conflict(episode_id) do update set provider=excluded.provider,demo_url=excluded.demo_url,ready=excluded.ready;
