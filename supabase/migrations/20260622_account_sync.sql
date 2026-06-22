-- TaskMate account and sync foundation for Supabase.
-- Run this in the Supabase SQL editor after creating your project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_task_id text not null,
  payload jsonb not null default '{}'::jsonb,
  source_device text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, local_task_id)
);

create table if not exists public.character_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_character_id text not null,
  name text not null,
  description text not null default '',
  dialogues jsonb not null default '{}'::jsonb,
  image_paths jsonb not null default '{}'::jsonb,
  source_device text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_character_id)
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending',
  note text not null default ''
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists task_items_set_updated_at on public.task_items;
create trigger task_items_set_updated_at
before update on public.task_items
for each row execute function public.set_updated_at();

drop trigger if exists character_packs_set_updated_at on public.character_packs;
create trigger character_packs_set_updated_at
before update on public.character_packs
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.task_items enable row level security;
alter table public.character_packs enable row level security;
alter table public.account_deletion_requests enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "task_items_select_own" on public.task_items;
create policy "task_items_select_own"
on public.task_items for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "task_items_insert_own" on public.task_items;
create policy "task_items_insert_own"
on public.task_items for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "task_items_update_own" on public.task_items;
create policy "task_items_update_own"
on public.task_items for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "task_items_delete_own" on public.task_items;
create policy "task_items_delete_own"
on public.task_items for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "character_packs_select_own" on public.character_packs;
create policy "character_packs_select_own"
on public.character_packs for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "character_packs_insert_own" on public.character_packs;
create policy "character_packs_insert_own"
on public.character_packs for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "character_packs_update_own" on public.character_packs;
create policy "character_packs_update_own"
on public.character_packs for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "character_packs_delete_own" on public.character_packs;
create policy "character_packs_delete_own"
on public.character_packs for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "account_deletion_requests_select_own" on public.account_deletion_requests;
create policy "account_deletion_requests_select_own"
on public.account_deletion_requests for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "account_deletion_requests_insert_own" on public.account_deletion_requests;
create policy "account_deletion_requests_insert_own"
on public.account_deletion_requests for insert
to authenticated
with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'taskmate-character-assets',
  'taskmate-character-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/json']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "character_assets_select_own" on storage.objects;
create policy "character_assets_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'taskmate-character-assets'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "character_assets_insert_own" on storage.objects;
create policy "character_assets_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'taskmate-character-assets'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "character_assets_update_own" on storage.objects;
create policy "character_assets_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'taskmate-character-assets'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'taskmate-character-assets'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "character_assets_delete_own" on storage.objects;
create policy "character_assets_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'taskmate-character-assets'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
