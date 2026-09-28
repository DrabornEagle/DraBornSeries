-- Explicit server-only policies. No client grants are added.
create policy dbs_backend_only on drabornseries.dbs_ad_events for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_admin_logs for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_admin_users for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_analytics_events for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_audio_tracks for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_content_schedule for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_promo_codes for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_purchase_receipts for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_rate_limits for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_recommendations for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_subtitles for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_video_access_tokens for all to service_role using(true) with check(true);
create policy dbs_backend_only on drabornseries.dbs_video_assets for all to service_role using(true) with check(true);
create function dbs_series_private.dbs_limit_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
 if (select count(*) from drabornseries.dbs_comments where user_id=auth.uid() and created_at>now()-interval '5 minutes')>=5 then raise exception 'COMMENT_RATE_LIMIT';end if;
 if exists(select 1 from drabornseries.dbs_comments where user_id=auth.uid() and body=new.body and created_at>now()-interval '1 day') then raise exception 'DUPLICATE_COMMENT';end if;
 end if;
 return new;
end $$;
revoke all on function dbs_series_private.dbs_limit_comment() from public,anon,authenticated;
create trigger dbs_comment_throttle before insert on drabornseries.dbs_comments for each row execute function dbs_series_private.dbs_limit_comment();
