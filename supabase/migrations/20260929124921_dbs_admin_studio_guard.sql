-- Revoked sessions must never retain owner write access through a direct RPC call.
create or replace function dbs_series_private.dbs_admin_grant_vip(account uuid, days integer, reason text, request_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare grant_end timestamptz;
begin
  if not dbs_series_private.dbs_admin() or
    not exists(select 1 from drabornseries.dbs_admin_users where user_id=auth.uid() and role='owner') then
    raise exception 'OWNER_REQUIRED';
  end if;
  if account is null or request_id is null or days not in (7,30,365) or length(trim(coalesce(reason,'')))<5 then
    raise exception 'INVALID_GRANT';
  end if;
  if not exists(select 1 from drabornseries.dbs_profiles where user_id=account and status='active') then
    raise exception 'ACCOUNT_UNAVAILABLE';
  end if;
  perform 1 from drabornseries.dbs_profiles where user_id=account for update;
  select expires_at into grant_end from drabornseries.dbs_vip_subscriptions where admin_request_id=request_id and user_id=account;
  if found then return grant_end; end if;
  if exists(select 1 from drabornseries.dbs_vip_subscriptions where admin_request_id=request_id) then
    raise exception 'REQUEST_ID_REUSED';
  end if;
  select greatest(now(),coalesce(max(expires_at),now())) + make_interval(days=>days)
    into grant_end from drabornseries.dbs_vip_subscriptions
    where user_id=account and provider='admin' and status='active' and expires_at>now();
  insert into drabornseries.dbs_vip_subscriptions(user_id,provider,product_id,status,starts_at,expires_at,auto_renew,admin_request_id)
    values(account,'admin','dbs_vip_admin_'||days,'active',now(),grant_end,false,request_id);
  insert into drabornseries.dbs_admin_logs(admin_id,action,target,detail)
    values(auth.uid(),'vip_grant',account::text,jsonb_build_object('days',days,'reason',reason,'request_id',request_id,'expires_at',grant_end));
  return grant_end;
end $$;
