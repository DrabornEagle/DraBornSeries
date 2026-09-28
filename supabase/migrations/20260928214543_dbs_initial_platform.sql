-- DraBornSeries: additive isolated objects only. Existing apps/auth triggers are untouched.
create schema if not exists drabornseries;
grant usage on schema drabornseries to anon,authenticated,service_role;
create schema if not exists dbs_series_private;
revoke all on schema dbs_series_private from public;
grant usage on schema dbs_series_private to authenticated, service_role;
create table drabornseries.dbs_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(length(username) between 3 and 40),
 avatar_url text, full_name text, language text not null default 'tr' check(language in ('tr','en')),
 birth_date date, preferences jsonb not null default '{}', status text not null default 'active' check(status in ('active','suspended','blocked','deleted')),
 created_at timestamptz not null default now()
);
create table drabornseries.dbs_admin_users (user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('owner','editor','support')), created_at timestamptz not null default now());
create table drabornseries.dbs_series (
 id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null, alternative_title text,
 description text not null default '', short_description text not null default '', title_en text, description_en text,
 poster_url text, banner_url text, accent text not null default '#f444a6', genres text[] not null default '{}', tags text[] not null default '{}',
 cast_names text[] not null default '{}', director text, production_year integer, country text default 'TR', age_rating text default '13+', language text default 'tr',
 status text not null default 'draft' check(status in ('draft','scheduled','published','hidden','archived','coming_soon')),
 is_demo boolean not null default false, is_vip boolean not null default false, featured_order integer, total_seasons integer default 1, total_episodes integer default 0,
 average_duration integer default 120, view_count bigint default 0, like_count bigint default 0, rating numeric(3,1) default 0,
 license text, release_at timestamptz, created_at timestamptz not null default now()
);
create table drabornseries.dbs_seasons (id uuid primary key default gen_random_uuid(), series_id uuid not null references drabornseries.dbs_series on delete cascade, number integer not null check(number>0), title text, unique(series_id,number));
create table drabornseries.dbs_episodes (
 id uuid primary key default gen_random_uuid(), series_id uuid not null references drabornseries.dbs_series on delete cascade,
 season_id uuid references drabornseries.dbs_seasons on delete cascade, number integer not null check(number>0), title text not null, description text default '',
 duration_seconds integer not null default 120 check(duration_seconds>0), thumbnail_url text, orientation text default 'landscape' check(orientation in ('landscape','portrait')),
 access_type text not null default 'free' check(access_type in ('free','coins','ad','vip','vip_or_coins','promotion')),
 coin_price integer not null default 0 check(coin_price>=0), vip_included boolean not null default false,
 status text not null default 'draft' check(status in ('draft','scheduled','published','hidden','archived')),
 publish_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(series_id,number),
 check(access_type not in ('coins','vip_or_coins') or coin_price>0)
);
create table drabornseries.dbs_video_assets (id uuid primary key default gen_random_uuid(), episode_id uuid unique references drabornseries.dbs_episodes on delete cascade, provider text not null check(provider in ('cloudflare','demo')), stream_uid text, demo_url text, r2_key text, ready boolean not null default false, created_at timestamptz default now(), check(provider<>'cloudflare' or stream_uid is not null));
create table drabornseries.dbs_borncoins_wallet (user_id uuid primary key references drabornseries.dbs_profiles on delete cascade, balance bigint not null default 0 check(balance>=0), updated_at timestamptz not null default now());
create table drabornseries.dbs_borncoins_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, amount bigint not null check(amount<>0), balance_after bigint not null check(balance_after>=0), kind text not null, reference text not null unique, description text, created_at timestamptz not null default now());
create table drabornseries.dbs_episode_unlocks (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, episode_id uuid not null references drabornseries.dbs_episodes on delete cascade, source text not null check(source in ('coins','ad','promotion','admin')), transaction_id uuid references drabornseries.dbs_borncoins_transactions, created_at timestamptz default now(), unique(user_id,episode_id));
create table drabornseries.dbs_vip_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, provider text not null default 'google_play', product_id text, token_hash text unique, status text not null check(status in ('active','grace','cancelled','expired','paused','revoked','pending')), starts_at timestamptz not null default now(), expires_at timestamptz not null, auto_renew boolean default false, updated_at timestamptz default now());
create table drabornseries.dbs_purchases (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, product_id text not null, token_hash text not null unique, order_id text, status text not null, quantity integer default 1, created_at timestamptz default now());
create table drabornseries.dbs_purchase_receipts (id uuid primary key default gen_random_uuid(), purchase_id uuid not null unique references drabornseries.dbs_purchases on delete cascade, receipt jsonb not null, created_at timestamptz default now());
create table drabornseries.dbs_google_play_products (id text primary key, kind text not null check(kind in ('coins','vip')), coins integer not null default 0, active boolean not null default false);
create table drabornseries.dbs_borncoins_products (id text primary key references drabornseries.dbs_google_play_products, coins integer not null, bonus integer not null default 0, sort_order integer default 0);
create table drabornseries.dbs_watch_progress (user_id uuid references drabornseries.dbs_profiles on delete cascade, episode_id uuid references drabornseries.dbs_episodes on delete cascade, position_seconds numeric not null default 0, duration_seconds numeric not null, completed boolean not null default false, device_id text, updated_at timestamptz not null default now(), primary key(user_id,episode_id));
create table drabornseries.dbs_watch_history (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, episode_id uuid not null references drabornseries.dbs_episodes on delete cascade, watched_seconds numeric not null default 0, device_id text, created_at timestamptz default now());
create table drabornseries.dbs_favorites (user_id uuid references drabornseries.dbs_profiles on delete cascade, series_id uuid references drabornseries.dbs_series on delete cascade, created_at timestamptz default now(), primary key(user_id,series_id));
create table drabornseries.dbs_likes (user_id uuid references drabornseries.dbs_profiles on delete cascade, series_id uuid references drabornseries.dbs_series on delete cascade, created_at timestamptz default now(), primary key(user_id,series_id));
create table drabornseries.dbs_ratings (user_id uuid references drabornseries.dbs_profiles on delete cascade, series_id uuid references drabornseries.dbs_series on delete cascade, value integer not null check(value between 1 and 5), created_at timestamptz default now(), primary key(user_id,series_id));
create table drabornseries.dbs_comments (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, series_id uuid not null references drabornseries.dbs_series on delete cascade, episode_id uuid references drabornseries.dbs_episodes on delete cascade, body text not null check(length(body) between 1 and 1000), spoiler boolean default false, status text not null default 'pending' check(status in ('pending','published','hidden')), created_at timestamptz default now());
create table drabornseries.dbs_comment_likes (user_id uuid references drabornseries.dbs_profiles on delete cascade, comment_id uuid references drabornseries.dbs_comments on delete cascade, primary key(user_id,comment_id));
create table drabornseries.dbs_daily_rewards (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, reward_date date not null, day_number integer not null, coins integer not null, created_at timestamptz default now(), unique(user_id,reward_date));
create table drabornseries.dbs_user_streaks (user_id uuid primary key references drabornseries.dbs_profiles on delete cascade, days integer not null default 0, last_claim_date date);
create table drabornseries.dbs_promo_codes (id uuid primary key default gen_random_uuid(), code text not null unique, coins integer not null check(coins>0), max_uses integer not null default 100, uses integer not null default 0, expires_at timestamptz not null, active boolean default true);
create table drabornseries.dbs_promo_redemptions (user_id uuid references drabornseries.dbs_profiles on delete cascade, promo_id uuid references drabornseries.dbs_promo_codes on delete cascade, created_at timestamptz default now(), primary key(user_id,promo_id));
create table drabornseries.dbs_devices (user_id uuid references drabornseries.dbs_profiles on delete cascade, device_id text not null, label text not null, platform text, last_seen_at timestamptz default now(), revoked_at timestamptz, primary key(user_id,device_id));
create table drabornseries.dbs_user_sessions (user_id uuid references drabornseries.dbs_profiles on delete cascade, session_id uuid not null, device_id text not null, revoked_at timestamptz, last_seen_at timestamptz default now(), primary key(user_id,session_id));
create table drabornseries.dbs_notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, title text not null, body text not null, kind text default 'system', link text, read_at timestamptz, created_at timestamptz default now());
create table drabornseries.dbs_notification_preferences (user_id uuid primary key references drabornseries.dbs_profiles on delete cascade, new_episodes boolean default true, promotions boolean default false, rewards boolean default true);
create table drabornseries.dbs_app_settings (key text primary key, value jsonb not null, public boolean not null default false);
create table drabornseries.dbs_admin_logs (id uuid primary key default gen_random_uuid(), admin_id uuid references auth.users, action text not null, target text, detail jsonb default '{}', created_at timestamptz default now());
create table drabornseries.dbs_reports (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, kind text not null, body text not null check(length(body) between 1 and 2000), status text not null default 'open', created_at timestamptz default now());
create table drabornseries.dbs_content_reports (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, episode_id uuid references drabornseries.dbs_episodes, series_id uuid references drabornseries.dbs_series, kind text not null, body text default '', status text not null default 'open', created_at timestamptz default now());
create table drabornseries.dbs_comment_reports (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, comment_id uuid references drabornseries.dbs_comments on delete cascade, body text not null, created_at timestamptz default now(), unique(user_id,comment_id));
create table drabornseries.dbs_search_history (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, query text not null check(length(query) between 1 and 120), created_at timestamptz default now());
create table drabornseries.dbs_analytics_events (id uuid primary key default gen_random_uuid(), user_id uuid references drabornseries.dbs_profiles on delete set null, name text not null, episode_id uuid references drabornseries.dbs_episodes on delete set null, properties jsonb default '{}', created_at timestamptz default now());
create table drabornseries.dbs_video_access_tokens (id uuid primary key default gen_random_uuid(), user_id uuid not null references drabornseries.dbs_profiles on delete cascade, episode_id uuid not null references drabornseries.dbs_episodes on delete cascade, expires_at timestamptz not null, created_at timestamptz default now());
create table drabornseries.dbs_rate_limits (key text primary key, window_start timestamptz not null, count integer not null);
create table drabornseries.dbs_ad_events (transaction_id text primary key, user_id uuid not null references drabornseries.dbs_profiles on delete cascade, reward_date date not null, placement text not null, created_at timestamptz default now());
create table drabornseries.dbs_categories (id text primary key, name text not null, name_en text, description text, data jsonb not null default '{}', active boolean not null default true);
create table drabornseries.dbs_genres (id text primary key, name text not null, name_en text, description text, data jsonb not null default '{}', active boolean not null default true);
create table drabornseries.dbs_languages (id text primary key, name text not null, name_en text, description text, data jsonb not null default '{}', active boolean not null default true);
create table drabornseries.dbs_cast (id text primary key, name text not null, name_en text, description text, data jsonb not null default '{}', active boolean not null default true);
create table drabornseries.dbs_achievements (id text primary key, name text not null, name_en text, description text, data jsonb not null default '{}', active boolean not null default true);
create table drabornseries.dbs_tasks (id text primary key, name text not null, name_en text, description text, data jsonb not null default '{}', active boolean not null default true);
create table drabornseries.dbs_rewards (id text primary key, name text not null, name_en text, description text, data jsonb not null default '{}', active boolean not null default true);
create table drabornseries.dbs_series_genres (series_id uuid references drabornseries.dbs_series on delete cascade, genres_id text references drabornseries.dbs_genres on delete cascade, primary key(series_id,genres_id));
create table drabornseries.dbs_series_categories (series_id uuid references drabornseries.dbs_series on delete cascade, categories_id text references drabornseries.dbs_categories on delete cascade, primary key(series_id,categories_id));
create table drabornseries.dbs_series_cast (series_id uuid references drabornseries.dbs_series on delete cascade, cast_id text references drabornseries.dbs_cast on delete cascade, primary key(series_id,cast_id));
create table drabornseries.dbs_user_achievements (user_id uuid references drabornseries.dbs_profiles on delete cascade, achievements_id text references drabornseries.dbs_achievements on delete cascade, progress integer default 0, claimed_at timestamptz, primary key(user_id,achievements_id));
create table drabornseries.dbs_user_tasks (user_id uuid references drabornseries.dbs_profiles on delete cascade, tasks_id text references drabornseries.dbs_tasks on delete cascade, progress integer default 0, claimed_at timestamptz, primary key(user_id,tasks_id));
create table drabornseries.dbs_subtitles (id uuid primary key default gen_random_uuid(), episode_id uuid references drabornseries.dbs_episodes on delete cascade, language text not null, label text not null, asset_key text not null);
create table drabornseries.dbs_audio_tracks (id uuid primary key default gen_random_uuid(), episode_id uuid references drabornseries.dbs_episodes on delete cascade, language text not null, label text not null, asset_key text not null);
create table drabornseries.dbs_promotions (id uuid primary key default gen_random_uuid(), name text not null, data jsonb not null default '{}', active boolean default true, starts_at timestamptz, ends_at timestamptz, sort_order integer default 0);
create table drabornseries.dbs_featured_content (id uuid primary key default gen_random_uuid(), name text not null, data jsonb not null default '{}', active boolean default true, starts_at timestamptz, ends_at timestamptz, sort_order integer default 0);
create table drabornseries.dbs_home_sections (id uuid primary key default gen_random_uuid(), name text not null, data jsonb not null default '{}', active boolean default true, starts_at timestamptz, ends_at timestamptz, sort_order integer default 0);
create table drabornseries.dbs_recommendations (id uuid primary key default gen_random_uuid(), name text not null, data jsonb not null default '{}', active boolean default true, starts_at timestamptz, ends_at timestamptz, sort_order integer default 0);
create table drabornseries.dbs_search_trends (id uuid primary key default gen_random_uuid(), name text not null, data jsonb not null default '{}', active boolean default true, starts_at timestamptz, ends_at timestamptz, sort_order integer default 0);
create table drabornseries.dbs_content_schedule (id uuid primary key default gen_random_uuid(), name text not null, data jsonb not null default '{}', active boolean default true, starts_at timestamptz, ends_at timestamptz, sort_order integer default 0);

-- Auth helpers live outside exposed schemas. User editable JWT metadata is never authorization.
create function dbs_series_private.dbs_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from drabornseries.dbs_profiles where user_id=(select auth.uid()) and status='active')
 and exists(select 1 from auth.sessions where id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=(select auth.uid()))
 and not exists(select 1 from drabornseries.dbs_user_sessions where user_id=(select auth.uid()) and session_id=nullif(auth.jwt()->>'session_id','')::uuid and revoked_at is not null)
$$;
create function dbs_series_private.dbs_admin() returns boolean language sql stable security definer set search_path='' as $$
 select dbs_series_private.dbs_active() and exists(select 1 from drabornseries.dbs_admin_users where user_id=(select auth.uid()))
$$;
create function dbs_series_private.dbs_vip() returns boolean language sql stable security definer set search_path='' as $$
 select dbs_series_private.dbs_active() and exists(select 1 from drabornseries.dbs_vip_subscriptions where user_id=(select auth.uid()) and status in ('active','grace','cancelled') and expires_at>now())
$$;
create function dbs_series_private.dbs_access(episode uuid) returns boolean language sql stable security definer set search_path='' as $$
 select dbs_series_private.dbs_active() and exists(select 1 from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id
 where e.id=episode and e.status='published' and e.publish_at<=now() and s.status='published' and
 (e.access_type='free' or exists(select 1 from drabornseries.dbs_episode_unlocks u where u.episode_id=e.id and u.user_id=(select auth.uid()))
 or ((e.access_type in ('vip','vip_or_coins') or e.vip_included) and dbs_series_private.dbs_vip())))
$$;
create function drabornseries.dbs_episode_access(episode uuid) returns boolean language sql stable security invoker set search_path='' as $$ select dbs_series_private.dbs_access(episode) $$;
create function drabornseries.dbs_is_admin() returns boolean language sql stable security invoker set search_path='' as $$ select dbs_series_private.dbs_admin() $$;
create function drabornseries.dbs_is_vip() returns boolean language sql stable security invoker set search_path='' as $$ select dbs_series_private.dbs_vip() $$;
create function dbs_series_private.dbs_bootstrap(device text, label text, platform text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or length(device)>100 or length(label)>100 then raise exception 'AUTH_REQUIRED'; end if;
 insert into drabornseries.dbs_profiles(user_id,username) values(auth.uid(),'viewer_'||replace(auth.uid()::text,'-','')) on conflict(user_id) do nothing;
 if not dbs_series_private.dbs_active() then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 insert into drabornseries.dbs_borncoins_wallet(user_id) values(auth.uid()) on conflict do nothing;
 insert into drabornseries.dbs_user_streaks(user_id) values(auth.uid()) on conflict do nothing;
 insert into drabornseries.dbs_devices(user_id,device_id,label,platform) values(auth.uid(),device,label,platform)
 on conflict(user_id,device_id) do update set last_seen_at=now(),label=excluded.label;
 insert into drabornseries.dbs_user_sessions(user_id,session_id,device_id) values(auth.uid(),(auth.jwt()->>'session_id')::uuid,device)
 on conflict(user_id,session_id) do update set last_seen_at=now();
end $$;
create function drabornseries.dbs_bootstrap(device text,label text,platform text) returns void language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_bootstrap(device,label,platform) $$;
-- Every ledger write locks its wallet and is idempotent. No client execute grant.
create function dbs_series_private.dbs_ledger(account uuid, delta bigint, kind text, reference text, description text) returns uuid language plpgsql security definer set search_path='' as $$
declare tx uuid; new_balance bigint;
begin
 perform 1 from drabornseries.dbs_borncoins_wallet where user_id=account for update;
 select id into tx from drabornseries.dbs_borncoins_transactions t where t.reference=dbs_ledger.reference;
 if tx is not null then return tx; end if;
 update drabornseries.dbs_borncoins_wallet set balance=balance+delta,updated_at=now() where user_id=account and balance+delta>=0 returning balance into new_balance;
 if new_balance is null then raise exception 'INSUFFICIENT_COINS'; end if;
 insert into drabornseries.dbs_borncoins_transactions(user_id,amount,balance_after,kind,reference,description) values(account,delta,new_balance,kind,reference,description) returning id into tx;
 return tx;
end $$;
create function dbs_series_private.dbs_unlock(episode uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ep drabornseries.dbs_episodes; tx uuid;
begin
 if not dbs_series_private.dbs_active() then raise exception 'AUTH_REQUIRED'; end if;
 perform 1 from drabornseries.dbs_borncoins_wallet where user_id=auth.uid() for update;
 if dbs_series_private.dbs_access(episode) then return jsonb_build_object('unlocked',true,'already',true); end if;
 select e.* into ep from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where e.id=episode and e.status='published' and e.publish_at<=now() and s.status='published';
 if ep.id is null then raise exception 'EPISODE_UNAVAILABLE'; end if;
 if ep.access_type not in ('coins','vip_or_coins') then raise exception 'ACCESS_METHOD_NOT_ALLOWED'; end if;
 if not exists(select 1 from drabornseries.dbs_video_assets where episode_id=episode and ready) then raise exception 'VIDEO_NOT_READY'; end if;
 tx:=dbs_series_private.dbs_ledger(auth.uid(),-ep.coin_price,'unlock','unlock:'||auth.uid()||':'||episode,ep.title);
 insert into drabornseries.dbs_episode_unlocks(user_id,episode_id,source,transaction_id) values(auth.uid(),episode,'coins',tx);
 return jsonb_build_object('unlocked',true);
end $$;
create function drabornseries.dbs_unlock_episode(episode uuid) returns jsonb language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_unlock(episode) $$;
create function dbs_series_private.dbs_claim_daily() returns jsonb language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'Europe/Istanbul')::date; streak drabornseries.dbs_user_streaks; next_day integer; amount integer;
begin
 if not dbs_series_private.dbs_active() then raise exception 'AUTH_REQUIRED'; end if;
 select * into streak from drabornseries.dbs_user_streaks where user_id=auth.uid() for update;
 if streak.last_claim_date=today then raise exception 'ALREADY_CLAIMED'; end if;
 next_day:=case when streak.last_claim_date=today-1 then streak.days+1 else 1 end;
 amount:=(array[2,3,5,5,7,10,20])[((next_day-1)%7)+1];
 perform dbs_series_private.dbs_ledger(auth.uid(),amount,'daily','daily:'||auth.uid()||':'||today,'Günlük ödül');
 insert into drabornseries.dbs_daily_rewards(user_id,reward_date,day_number,coins) values(auth.uid(),today,next_day,amount);
 update drabornseries.dbs_user_streaks set days=next_day,last_claim_date=today where user_id=auth.uid();
 return jsonb_build_object('coins',amount,'streak',next_day);
end $$;
create function drabornseries.dbs_claim_daily() returns jsonb language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_claim_daily() $$;
create function dbs_series_private.dbs_redeem(code text) returns integer language plpgsql security definer set search_path='' as $$
declare promo drabornseries.dbs_promo_codes;
begin
 if not dbs_series_private.dbs_active() then raise exception 'AUTH_REQUIRED'; end if;
 select * into promo from drabornseries.dbs_promo_codes p where p.code=upper(trim(dbs_redeem.code)) and active and expires_at>now() for update;
 if promo.id is null or promo.uses>=promo.max_uses then raise exception 'INVALID_PROMO'; end if;
 if exists(select 1 from drabornseries.dbs_promo_redemptions where user_id=auth.uid() and promo_id=promo.id) then raise exception 'ALREADY_CLAIMED'; end if;
 insert into drabornseries.dbs_promo_redemptions values(auth.uid(),promo.id,now());
 perform dbs_series_private.dbs_ledger(auth.uid(),promo.coins,'promotion','promo:'||auth.uid()||':'||promo.id,'Promosyon');
 update drabornseries.dbs_promo_codes set uses=uses+1 where id=promo.id;
 return promo.coins;
end $$;
create function drabornseries.dbs_redeem_promo(code text) returns integer language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_redeem(code) $$;
create function dbs_series_private.dbs_save_progress(episode uuid, seconds numeric, device text, observed_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare duration integer;
begin
 if not dbs_series_private.dbs_access(episode) then raise exception 'ACCESS_DENIED'; end if;
 if seconds<0 or observed_at>now()+interval '1 minute' then raise exception 'INVALID_PROGRESS'; end if;
 select duration_seconds into duration from drabornseries.dbs_episodes where id=episode;
 insert into drabornseries.dbs_watch_progress values(auth.uid(),episode,least(seconds,duration),duration,seconds>=duration*0.9,device,least(observed_at,now()))
 on conflict(user_id,episode_id) do update set position_seconds=excluded.position_seconds,duration_seconds=excluded.duration_seconds,completed=excluded.completed,device_id=excluded.device_id,updated_at=excluded.updated_at where drabornseries.dbs_watch_progress.updated_at<=excluded.updated_at;
end $$;
create function drabornseries.dbs_save_progress(episode uuid,seconds numeric,device text,observed_at timestamptz) returns void language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_save_progress(episode,seconds,device,observed_at) $$;
create function dbs_series_private.dbs_revoke_session(session uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not dbs_series_private.dbs_active() then raise exception 'AUTH_REQUIRED'; end if;
 update drabornseries.dbs_user_sessions set revoked_at=now() where user_id=auth.uid() and session_id=session;
end $$;
create function drabornseries.dbs_revoke_session(session uuid) returns void language sql security invoker set search_path='' as $$ select dbs_series_private.dbs_revoke_session(session) $$;
alter table drabornseries.dbs_profiles enable row level security;
revoke all on drabornseries.dbs_profiles from anon,authenticated;
grant all on drabornseries.dbs_profiles to service_role;
alter table drabornseries.dbs_admin_users enable row level security;
revoke all on drabornseries.dbs_admin_users from anon,authenticated;
grant all on drabornseries.dbs_admin_users to service_role;
alter table drabornseries.dbs_series enable row level security;
revoke all on drabornseries.dbs_series from anon,authenticated;
grant all on drabornseries.dbs_series to service_role;
alter table drabornseries.dbs_seasons enable row level security;
revoke all on drabornseries.dbs_seasons from anon,authenticated;
grant all on drabornseries.dbs_seasons to service_role;
alter table drabornseries.dbs_episodes enable row level security;
revoke all on drabornseries.dbs_episodes from anon,authenticated;
grant all on drabornseries.dbs_episodes to service_role;
alter table drabornseries.dbs_video_assets enable row level security;
revoke all on drabornseries.dbs_video_assets from anon,authenticated;
grant all on drabornseries.dbs_video_assets to service_role;
alter table drabornseries.dbs_borncoins_wallet enable row level security;
revoke all on drabornseries.dbs_borncoins_wallet from anon,authenticated;
grant all on drabornseries.dbs_borncoins_wallet to service_role;
alter table drabornseries.dbs_borncoins_transactions enable row level security;
revoke all on drabornseries.dbs_borncoins_transactions from anon,authenticated;
grant all on drabornseries.dbs_borncoins_transactions to service_role;
alter table drabornseries.dbs_episode_unlocks enable row level security;
revoke all on drabornseries.dbs_episode_unlocks from anon,authenticated;
grant all on drabornseries.dbs_episode_unlocks to service_role;
alter table drabornseries.dbs_vip_subscriptions enable row level security;
revoke all on drabornseries.dbs_vip_subscriptions from anon,authenticated;
grant all on drabornseries.dbs_vip_subscriptions to service_role;
alter table drabornseries.dbs_purchases enable row level security;
revoke all on drabornseries.dbs_purchases from anon,authenticated;
grant all on drabornseries.dbs_purchases to service_role;
alter table drabornseries.dbs_purchase_receipts enable row level security;
revoke all on drabornseries.dbs_purchase_receipts from anon,authenticated;
grant all on drabornseries.dbs_purchase_receipts to service_role;
alter table drabornseries.dbs_google_play_products enable row level security;
revoke all on drabornseries.dbs_google_play_products from anon,authenticated;
grant all on drabornseries.dbs_google_play_products to service_role;
alter table drabornseries.dbs_borncoins_products enable row level security;
revoke all on drabornseries.dbs_borncoins_products from anon,authenticated;
grant all on drabornseries.dbs_borncoins_products to service_role;
alter table drabornseries.dbs_watch_progress enable row level security;
revoke all on drabornseries.dbs_watch_progress from anon,authenticated;
grant all on drabornseries.dbs_watch_progress to service_role;
alter table drabornseries.dbs_watch_history enable row level security;
revoke all on drabornseries.dbs_watch_history from anon,authenticated;
grant all on drabornseries.dbs_watch_history to service_role;
alter table drabornseries.dbs_favorites enable row level security;
revoke all on drabornseries.dbs_favorites from anon,authenticated;
grant all on drabornseries.dbs_favorites to service_role;
alter table drabornseries.dbs_likes enable row level security;
revoke all on drabornseries.dbs_likes from anon,authenticated;
grant all on drabornseries.dbs_likes to service_role;
alter table drabornseries.dbs_ratings enable row level security;
revoke all on drabornseries.dbs_ratings from anon,authenticated;
grant all on drabornseries.dbs_ratings to service_role;
alter table drabornseries.dbs_comments enable row level security;
revoke all on drabornseries.dbs_comments from anon,authenticated;
grant all on drabornseries.dbs_comments to service_role;
alter table drabornseries.dbs_comment_likes enable row level security;
revoke all on drabornseries.dbs_comment_likes from anon,authenticated;
grant all on drabornseries.dbs_comment_likes to service_role;
alter table drabornseries.dbs_daily_rewards enable row level security;
revoke all on drabornseries.dbs_daily_rewards from anon,authenticated;
grant all on drabornseries.dbs_daily_rewards to service_role;
alter table drabornseries.dbs_user_streaks enable row level security;
revoke all on drabornseries.dbs_user_streaks from anon,authenticated;
grant all on drabornseries.dbs_user_streaks to service_role;
alter table drabornseries.dbs_promo_codes enable row level security;
revoke all on drabornseries.dbs_promo_codes from anon,authenticated;
grant all on drabornseries.dbs_promo_codes to service_role;
alter table drabornseries.dbs_promo_redemptions enable row level security;
revoke all on drabornseries.dbs_promo_redemptions from anon,authenticated;
grant all on drabornseries.dbs_promo_redemptions to service_role;
alter table drabornseries.dbs_devices enable row level security;
revoke all on drabornseries.dbs_devices from anon,authenticated;
grant all on drabornseries.dbs_devices to service_role;
alter table drabornseries.dbs_user_sessions enable row level security;
revoke all on drabornseries.dbs_user_sessions from anon,authenticated;
grant all on drabornseries.dbs_user_sessions to service_role;
alter table drabornseries.dbs_notifications enable row level security;
revoke all on drabornseries.dbs_notifications from anon,authenticated;
grant all on drabornseries.dbs_notifications to service_role;
alter table drabornseries.dbs_notification_preferences enable row level security;
revoke all on drabornseries.dbs_notification_preferences from anon,authenticated;
grant all on drabornseries.dbs_notification_preferences to service_role;
alter table drabornseries.dbs_app_settings enable row level security;
revoke all on drabornseries.dbs_app_settings from anon,authenticated;
grant all on drabornseries.dbs_app_settings to service_role;
alter table drabornseries.dbs_admin_logs enable row level security;
revoke all on drabornseries.dbs_admin_logs from anon,authenticated;
grant all on drabornseries.dbs_admin_logs to service_role;
alter table drabornseries.dbs_reports enable row level security;
revoke all on drabornseries.dbs_reports from anon,authenticated;
grant all on drabornseries.dbs_reports to service_role;
alter table drabornseries.dbs_content_reports enable row level security;
revoke all on drabornseries.dbs_content_reports from anon,authenticated;
grant all on drabornseries.dbs_content_reports to service_role;
alter table drabornseries.dbs_comment_reports enable row level security;
revoke all on drabornseries.dbs_comment_reports from anon,authenticated;
grant all on drabornseries.dbs_comment_reports to service_role;
alter table drabornseries.dbs_search_history enable row level security;
revoke all on drabornseries.dbs_search_history from anon,authenticated;
grant all on drabornseries.dbs_search_history to service_role;
alter table drabornseries.dbs_analytics_events enable row level security;
revoke all on drabornseries.dbs_analytics_events from anon,authenticated;
grant all on drabornseries.dbs_analytics_events to service_role;
alter table drabornseries.dbs_video_access_tokens enable row level security;
revoke all on drabornseries.dbs_video_access_tokens from anon,authenticated;
grant all on drabornseries.dbs_video_access_tokens to service_role;
alter table drabornseries.dbs_rate_limits enable row level security;
revoke all on drabornseries.dbs_rate_limits from anon,authenticated;
grant all on drabornseries.dbs_rate_limits to service_role;
alter table drabornseries.dbs_ad_events enable row level security;
revoke all on drabornseries.dbs_ad_events from anon,authenticated;
grant all on drabornseries.dbs_ad_events to service_role;
alter table drabornseries.dbs_categories enable row level security;
revoke all on drabornseries.dbs_categories from anon,authenticated;
grant all on drabornseries.dbs_categories to service_role;
alter table drabornseries.dbs_genres enable row level security;
revoke all on drabornseries.dbs_genres from anon,authenticated;
grant all on drabornseries.dbs_genres to service_role;
alter table drabornseries.dbs_languages enable row level security;
revoke all on drabornseries.dbs_languages from anon,authenticated;
grant all on drabornseries.dbs_languages to service_role;
alter table drabornseries.dbs_cast enable row level security;
revoke all on drabornseries.dbs_cast from anon,authenticated;
grant all on drabornseries.dbs_cast to service_role;
alter table drabornseries.dbs_achievements enable row level security;
revoke all on drabornseries.dbs_achievements from anon,authenticated;
grant all on drabornseries.dbs_achievements to service_role;
alter table drabornseries.dbs_tasks enable row level security;
revoke all on drabornseries.dbs_tasks from anon,authenticated;
grant all on drabornseries.dbs_tasks to service_role;
alter table drabornseries.dbs_rewards enable row level security;
revoke all on drabornseries.dbs_rewards from anon,authenticated;
grant all on drabornseries.dbs_rewards to service_role;
alter table drabornseries.dbs_series_genres enable row level security;
revoke all on drabornseries.dbs_series_genres from anon,authenticated;
grant all on drabornseries.dbs_series_genres to service_role;
alter table drabornseries.dbs_series_categories enable row level security;
revoke all on drabornseries.dbs_series_categories from anon,authenticated;
grant all on drabornseries.dbs_series_categories to service_role;
alter table drabornseries.dbs_series_cast enable row level security;
revoke all on drabornseries.dbs_series_cast from anon,authenticated;
grant all on drabornseries.dbs_series_cast to service_role;
alter table drabornseries.dbs_user_achievements enable row level security;
revoke all on drabornseries.dbs_user_achievements from anon,authenticated;
grant all on drabornseries.dbs_user_achievements to service_role;
alter table drabornseries.dbs_user_tasks enable row level security;
revoke all on drabornseries.dbs_user_tasks from anon,authenticated;
grant all on drabornseries.dbs_user_tasks to service_role;
alter table drabornseries.dbs_subtitles enable row level security;
revoke all on drabornseries.dbs_subtitles from anon,authenticated;
grant all on drabornseries.dbs_subtitles to service_role;
alter table drabornseries.dbs_audio_tracks enable row level security;
revoke all on drabornseries.dbs_audio_tracks from anon,authenticated;
grant all on drabornseries.dbs_audio_tracks to service_role;
alter table drabornseries.dbs_promotions enable row level security;
revoke all on drabornseries.dbs_promotions from anon,authenticated;
grant all on drabornseries.dbs_promotions to service_role;
alter table drabornseries.dbs_featured_content enable row level security;
revoke all on drabornseries.dbs_featured_content from anon,authenticated;
grant all on drabornseries.dbs_featured_content to service_role;
alter table drabornseries.dbs_home_sections enable row level security;
revoke all on drabornseries.dbs_home_sections from anon,authenticated;
grant all on drabornseries.dbs_home_sections to service_role;
alter table drabornseries.dbs_recommendations enable row level security;
revoke all on drabornseries.dbs_recommendations from anon,authenticated;
grant all on drabornseries.dbs_recommendations to service_role;
alter table drabornseries.dbs_search_trends enable row level security;
revoke all on drabornseries.dbs_search_trends from anon,authenticated;
grant all on drabornseries.dbs_search_trends to service_role;
alter table drabornseries.dbs_content_schedule enable row level security;
revoke all on drabornseries.dbs_content_schedule from anon,authenticated;
grant all on drabornseries.dbs_content_schedule to service_role;
grant select on drabornseries.dbs_series to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_series for select to anon,authenticated using (status in ('published','coming_soon'));
grant select on drabornseries.dbs_seasons to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_seasons for select to anon,authenticated using (exists(select 1 from drabornseries.dbs_series s where s.id=series_id and s.status in ('published','coming_soon')));
grant select on drabornseries.dbs_episodes to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_episodes for select to anon,authenticated using (status='published' and publish_at<=now() and exists(select 1 from drabornseries.dbs_series s where s.id=series_id and s.status='published'));
grant select on drabornseries.dbs_categories to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_categories for select to anon,authenticated using (true);
grant select on drabornseries.dbs_genres to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_genres for select to anon,authenticated using (true);
grant select on drabornseries.dbs_series_genres to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_series_genres for select to anon,authenticated using (exists(select 1 from drabornseries.dbs_series s where s.id=series_id and s.status in ('published','coming_soon')));
grant select on drabornseries.dbs_series_categories to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_series_categories for select to anon,authenticated using (exists(select 1 from drabornseries.dbs_series s where s.id=series_id and s.status in ('published','coming_soon')));
grant select on drabornseries.dbs_cast to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_cast for select to anon,authenticated using (true);
grant select on drabornseries.dbs_series_cast to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_series_cast for select to anon,authenticated using (exists(select 1 from drabornseries.dbs_series s where s.id=series_id and s.status in ('published','coming_soon')));
grant select on drabornseries.dbs_languages to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_languages for select to anon,authenticated using (true);
grant select on drabornseries.dbs_achievements to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_achievements for select to anon,authenticated using (true);
grant select on drabornseries.dbs_tasks to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_tasks for select to anon,authenticated using (true);
grant select on drabornseries.dbs_rewards to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_rewards for select to anon,authenticated using (true);
grant select on drabornseries.dbs_borncoins_products to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_borncoins_products for select to anon,authenticated using (true);
grant select on drabornseries.dbs_google_play_products to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_google_play_products for select to anon,authenticated using (true);
grant select on drabornseries.dbs_home_sections to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_home_sections for select to anon,authenticated using (true);
grant select on drabornseries.dbs_featured_content to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_featured_content for select to anon,authenticated using (true);
grant select on drabornseries.dbs_promotions to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_promotions for select to anon,authenticated using (true);
grant select on drabornseries.dbs_search_trends to anon,authenticated;
create policy dbs_catalog_read on drabornseries.dbs_search_trends for select to anon,authenticated using (true);
grant select on drabornseries.dbs_profiles to authenticated;
create policy dbs_own_read on drabornseries.dbs_profiles for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_borncoins_wallet to authenticated;
create policy dbs_own_read on drabornseries.dbs_borncoins_wallet for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_borncoins_transactions to authenticated;
create policy dbs_own_read on drabornseries.dbs_borncoins_transactions for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_episode_unlocks to authenticated;
create policy dbs_own_read on drabornseries.dbs_episode_unlocks for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_vip_subscriptions to authenticated;
create policy dbs_own_read on drabornseries.dbs_vip_subscriptions for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_purchases to authenticated;
create policy dbs_own_read on drabornseries.dbs_purchases for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_watch_progress to authenticated;
create policy dbs_own_read on drabornseries.dbs_watch_progress for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_watch_history to authenticated;
create policy dbs_own_read on drabornseries.dbs_watch_history for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_favorites to authenticated;
create policy dbs_own_read on drabornseries.dbs_favorites for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_likes to authenticated;
create policy dbs_own_read on drabornseries.dbs_likes for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_ratings to authenticated;
create policy dbs_own_read on drabornseries.dbs_ratings for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_comments to authenticated;
create policy dbs_own_read on drabornseries.dbs_comments for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_comment_likes to authenticated;
create policy dbs_own_read on drabornseries.dbs_comment_likes for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_comment_reports to authenticated;
create policy dbs_own_read on drabornseries.dbs_comment_reports for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_daily_rewards to authenticated;
create policy dbs_own_read on drabornseries.dbs_daily_rewards for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_user_streaks to authenticated;
create policy dbs_own_read on drabornseries.dbs_user_streaks for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_promo_redemptions to authenticated;
create policy dbs_own_read on drabornseries.dbs_promo_redemptions for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_devices to authenticated;
create policy dbs_own_read on drabornseries.dbs_devices for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_user_sessions to authenticated;
create policy dbs_own_read on drabornseries.dbs_user_sessions for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_notifications to authenticated;
create policy dbs_own_read on drabornseries.dbs_notifications for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_notification_preferences to authenticated;
create policy dbs_own_read on drabornseries.dbs_notification_preferences for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_reports to authenticated;
create policy dbs_own_read on drabornseries.dbs_reports for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_content_reports to authenticated;
create policy dbs_own_read on drabornseries.dbs_content_reports for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_search_history to authenticated;
create policy dbs_own_read on drabornseries.dbs_search_history for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_user_achievements to authenticated;
create policy dbs_own_read on drabornseries.dbs_user_achievements for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_user_tasks to authenticated;
create policy dbs_own_read on drabornseries.dbs_user_tasks for select to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant insert,update,delete on drabornseries.dbs_favorites to authenticated;
create policy dbs_own_write on drabornseries.dbs_favorites for all to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant insert,update,delete on drabornseries.dbs_likes to authenticated;
create policy dbs_own_write on drabornseries.dbs_likes for all to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant insert,update,delete on drabornseries.dbs_ratings to authenticated;
create policy dbs_own_write on drabornseries.dbs_ratings for all to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant insert,update,delete on drabornseries.dbs_comment_likes to authenticated;
create policy dbs_own_write on drabornseries.dbs_comment_likes for all to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant insert,update,delete on drabornseries.dbs_notification_preferences to authenticated;
create policy dbs_own_write on drabornseries.dbs_notification_preferences for all to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant insert,update,delete on drabornseries.dbs_search_history to authenticated;
create policy dbs_own_write on drabornseries.dbs_search_history for all to authenticated using (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check (user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));

grant update(username,avatar_url,full_name,language,birth_date,preferences) on drabornseries.dbs_profiles to authenticated;
create policy dbs_profile_update on drabornseries.dbs_profiles for update to authenticated using(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant insert(user_id,series_id,episode_id,body,spoiler),delete on drabornseries.dbs_comments to authenticated;
create policy dbs_comment_insert on drabornseries.dbs_comments for insert to authenticated with check(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()) and status='pending');
create policy dbs_comment_delete on drabornseries.dbs_comments for delete to authenticated using(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
create policy dbs_comment_published on drabornseries.dbs_comments for select to authenticated using(status='published' and (select dbs_series_private.dbs_active()));
grant insert(user_id,kind,body) on drabornseries.dbs_reports to authenticated;
grant insert(user_id,episode_id,series_id,kind,body) on drabornseries.dbs_content_reports to authenticated;
grant insert(user_id,comment_id,body) on drabornseries.dbs_comment_reports to authenticated;
create policy dbs_report_insert on drabornseries.dbs_reports for insert to authenticated with check(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()) and status='open');
create policy dbs_content_report_insert on drabornseries.dbs_content_reports for insert to authenticated with check(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()) and status='open');
create policy dbs_comment_report_insert on drabornseries.dbs_comment_reports for insert to authenticated with check(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant update(read_at) on drabornseries.dbs_notifications to authenticated;
create policy dbs_notification_update on drabornseries.dbs_notifications for update to authenticated using(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active())) with check(user_id=(select auth.uid()) and (select dbs_series_private.dbs_active()));
grant select on drabornseries.dbs_app_settings to anon,authenticated;
create policy dbs_public_settings on drabornseries.dbs_app_settings for select to anon,authenticated using(public);
revoke all on function dbs_series_private.dbs_active() from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_active() to authenticated,service_role;
revoke all on function dbs_series_private.dbs_admin() from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_admin() to authenticated,service_role;
revoke all on function dbs_series_private.dbs_vip() from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_vip() to authenticated,service_role;
revoke all on function dbs_series_private.dbs_access(uuid) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_access(uuid) to authenticated,service_role;
revoke all on function drabornseries.dbs_episode_access(uuid) from public,anon,authenticated;
grant execute on function drabornseries.dbs_episode_access(uuid) to authenticated,service_role;
revoke all on function drabornseries.dbs_is_admin() from public,anon,authenticated;
grant execute on function drabornseries.dbs_is_admin() to authenticated,service_role;
revoke all on function drabornseries.dbs_is_vip() from public,anon,authenticated;
grant execute on function drabornseries.dbs_is_vip() to authenticated,service_role;
revoke all on function dbs_series_private.dbs_bootstrap(text,text,text) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_bootstrap(text,text,text) to authenticated,service_role;
revoke all on function drabornseries.dbs_bootstrap(text,text,text) from public,anon,authenticated;
grant execute on function drabornseries.dbs_bootstrap(text,text,text) to authenticated,service_role;
revoke all on function dbs_series_private.dbs_ledger(uuid,bigint,text,text,text) from public,anon,authenticated;
revoke all on function dbs_series_private.dbs_unlock(uuid) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_unlock(uuid) to authenticated,service_role;
revoke all on function drabornseries.dbs_unlock_episode(uuid) from public,anon,authenticated;
grant execute on function drabornseries.dbs_unlock_episode(uuid) to authenticated,service_role;
revoke all on function dbs_series_private.dbs_claim_daily() from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_claim_daily() to authenticated,service_role;
revoke all on function drabornseries.dbs_claim_daily() from public,anon,authenticated;
grant execute on function drabornseries.dbs_claim_daily() to authenticated,service_role;
revoke all on function dbs_series_private.dbs_redeem(text) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_redeem(text) to authenticated,service_role;
revoke all on function drabornseries.dbs_redeem_promo(text) from public,anon,authenticated;
grant execute on function drabornseries.dbs_redeem_promo(text) to authenticated,service_role;
revoke all on function dbs_series_private.dbs_save_progress(uuid,numeric,text,timestamptz) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_save_progress(uuid,numeric,text,timestamptz) to authenticated,service_role;
revoke all on function drabornseries.dbs_save_progress(uuid,numeric,text,timestamptz) from public,anon,authenticated;
grant execute on function drabornseries.dbs_save_progress(uuid,numeric,text,timestamptz) to authenticated,service_role;
revoke all on function dbs_series_private.dbs_revoke_session(uuid) from public,anon,authenticated;
grant execute on function dbs_series_private.dbs_revoke_session(uuid) to authenticated,service_role;
revoke all on function drabornseries.dbs_revoke_session(uuid) from public,anon,authenticated;
grant execute on function drabornseries.dbs_revoke_session(uuid) to authenticated,service_role;
create index dbs_borncoins_transactions_user_created on drabornseries.dbs_borncoins_transactions(user_id,created_at desc);
create index dbs_watch_history_user_created on drabornseries.dbs_watch_history(user_id,created_at desc);
create index dbs_notifications_user_created on drabornseries.dbs_notifications(user_id,created_at desc);
create index dbs_purchases_user_created on drabornseries.dbs_purchases(user_id,created_at desc);
create index dbs_content_reports_user_created on drabornseries.dbs_content_reports(user_id,created_at desc);

create index dbs_progress_recent on drabornseries.dbs_watch_progress(user_id,updated_at desc);
create index dbs_episodes_catalog on drabornseries.dbs_episodes(series_id,status,publish_at);
create index dbs_series_search on drabornseries.dbs_series using gin(to_tsvector('simple',title||' '||coalesce(alternative_title,'')||' '||description));
create index dbs_series_genres_gin on drabornseries.dbs_series using gin(genres);
create index dbs_vip_expiry on drabornseries.dbs_vip_subscriptions(user_id,expires_at);
create index dbs_comments_series on drabornseries.dbs_comments(series_id,status,created_at desc);
create index dbs_ad_events_user_date on drabornseries.dbs_ad_events(user_id,reward_date);
