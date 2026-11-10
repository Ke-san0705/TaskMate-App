-- Muse may only append via the service-only RPC. Clients never receive a service key.
create table if not exists public.task_inbox_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  token_suffix text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  usage_day date,
  daily_count integer not null default 0 check (daily_count >= 0)
);
create table if not exists public.task_inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'muse' check (source = 'muse'),
  external_id text not null check (length(external_id) between 1 and 200),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb,
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  unique (user_id, source, external_id)
);
create index if not exists task_inbox_pending on public.task_inbox_items(user_id, id) where imported_at is null;
alter table public.task_inbox_keys enable row level security;
alter table public.task_inbox_items enable row level security;
revoke all on public.task_inbox_keys, public.task_inbox_items from anon, authenticated;
grant select (id, user_id, token_suffix, created_at, revoked_at, last_used_at) on public.task_inbox_keys to authenticated;
grant select on public.task_inbox_items to authenticated;
grant all on public.task_inbox_keys, public.task_inbox_items to service_role;
drop policy if exists task_inbox_keys_own on public.task_inbox_keys;
create policy task_inbox_keys_own on public.task_inbox_keys for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists task_inbox_items_own on public.task_inbox_items;
create policy task_inbox_items_own on public.task_inbox_items for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.task_inbox_create_key(p_user_id uuid, p_hash text, p_suffix text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if (select count(*) from public.task_inbox_keys where user_id=p_user_id and revoked_at is null) >= 3 then
    raise sqlstate 'PT429' using message='Active key limit reached.';
  end if;
  insert into public.task_inbox_keys(user_id,token_hash,token_suffix) values(p_user_id,p_hash,p_suffix) returning id into v_id;
  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.task_inbox_ingest(p_hash text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_key public.task_inbox_keys%rowtype;
  v_existing public.task_inbox_items%rowtype;
  v_item jsonb;
  v_count integer := 0;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_id uuid;
  v_results jsonb := '[]';
begin
  -- Resolve ownership without a row lock. All operations take the user lock
  -- first, so an erase cannot deadlock against a submission holding this key.
  select * into v_key from public.task_inbox_keys where token_hash=p_hash;
  if not found or v_key.revoked_at is not null then raise sqlstate 'PT401' using message='Invalid integration key.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key.user_id::text, 0));
  -- The key may have been erased or revoked while waiting for the user lock.
  select * into v_key from public.task_inbox_keys where token_hash=p_hash for update;
  if not found or v_key.revoked_at is not null then raise sqlstate 'PT401' using message='Invalid integration key.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise sqlstate 'PT400' using message='Invalid batch.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_existing from public.task_inbox_items where user_id=v_key.user_id and source='muse' and external_id=v_item->>'externalId';
    if found then
      if v_existing.payload_hash <> v_item->>'hash' then raise sqlstate 'PT409' using message='externalId already has different content.'; end if;
    else v_count := v_count + 1;
    end if;
  end loop;
  if (case when v_key.usage_day=v_today then v_key.daily_count else 0 end)+v_count > 200 then
    raise sqlstate 'PT429' using message='Daily task limit reached.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_existing from public.task_inbox_items where user_id=v_key.user_id and source='muse' and external_id=v_item->>'externalId';
    if found then
      v_results := v_results || jsonb_build_array(jsonb_build_object('id',v_existing.id,'externalId',v_item->>'externalId','duplicate',true,'imported',v_existing.imported_at is not null));
    else
      insert into public.task_inbox_items(user_id,external_id,payload_hash,payload)
      values(v_key.user_id,v_item->>'externalId',v_item->>'hash',v_item->'task') returning id into v_id;
      v_results := v_results || jsonb_build_array(jsonb_build_object('id',v_id,'externalId',v_item->>'externalId','duplicate',false,'imported',false));
    end if;
  end loop;
  update public.task_inbox_keys set usage_day=v_today,daily_count=(case when usage_day=v_today then daily_count else 0 end)+v_count,last_used_at=now() where id=v_key.id;
  return jsonb_build_object('items',v_results);
end;
$$;

create or replace function public.task_inbox_ack(p_user_id uuid, p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.task_inbox_items set imported_at=coalesce(imported_at,now()),payload=null where user_id=p_user_id and id=any(p_ids);
$$;
create or replace function public.task_inbox_clear(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from public.task_inbox_keys where user_id=p_user_id;
  delete from public.task_inbox_items where user_id=p_user_id;
end;
$$;
revoke all on function public.task_inbox_create_key(uuid,text,text), public.task_inbox_ingest(text,jsonb), public.task_inbox_ack(uuid,uuid[]), public.task_inbox_clear(uuid) from public, anon, authenticated;
grant execute on function public.task_inbox_create_key(uuid,text,text), public.task_inbox_ingest(text,jsonb), public.task_inbox_ack(uuid,uuid[]), public.task_inbox_clear(uuid) to service_role;
