-- Ori♡n Shows V2.0 · Supabase setup
-- Run this entire file in Supabase > SQL Editor.
-- This project intentionally has NO accounts: the anon role can read and edit all application data.

create table if not exists public.orion_workspace (
  id text primary key check (id = 'main'),
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.orion_shows (
  id text primary key,
  public_slug text not null unique,
  data jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.orion_show_locks (
  show_id text primary key references public.orion_shows(id) on delete cascade,
  client_id text not null,
  device_label text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists orion_shows_public_slug_idx on public.orion_shows(public_slug);
create index if not exists orion_show_locks_expires_idx on public.orion_show_locks(expires_at);

alter table public.orion_workspace enable row level security;
alter table public.orion_shows enable row level security;
alter table public.orion_show_locks enable row level security;

grant select, insert, update, delete on public.orion_workspace to anon, authenticated;
grant select, insert, update, delete on public.orion_shows to anon, authenticated;
grant select, insert, update, delete on public.orion_show_locks to anon, authenticated;

drop policy if exists "orion workspace open access" on public.orion_workspace;
create policy "orion workspace open access" on public.orion_workspace
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "orion shows open access" on public.orion_shows;
create policy "orion shows open access" on public.orion_shows
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "orion locks open access" on public.orion_show_locks;
create policy "orion locks open access" on public.orion_show_locks
  for all to anon, authenticated using (true) with check (true);

create or replace function public.orion_save_workspace(
  p_data jsonb,
  p_expected_revision bigint
)
returns table (
  applied boolean,
  reason text,
  id text,
  data jsonb,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orion_workspace%rowtype;
begin
  select w.* into v_row
  from public.orion_workspace as w
  where w.id = 'main'
  for update;

  if not found then
    if p_expected_revision <> 0 then
      return query select false, 'missing'::text, null::text, null::jsonb, null::bigint, null::timestamptz;
      return;
    end if;

    insert into public.orion_workspace (id, data, revision, updated_at)
    values ('main', coalesce(p_data, '{}'::jsonb), 1, clock_timestamp())
    returning * into v_row;

    return query select true, 'saved'::text, v_row.id, v_row.data, v_row.revision, v_row.updated_at;
    return;
  end if;

  if v_row.revision <> p_expected_revision then
    return query select false, 'conflict'::text, v_row.id, v_row.data, v_row.revision, v_row.updated_at;
    return;
  end if;

  update public.orion_workspace as w
  set data = coalesce(p_data, '{}'::jsonb),
      revision = w.revision + 1,
      updated_at = clock_timestamp()
  where w.id = 'main'
  returning w.* into v_row;

  return query select true, 'saved'::text, v_row.id, v_row.data, v_row.revision, v_row.updated_at;
end;
$$;

create or replace function public.orion_save_show(
  p_id text,
  p_public_slug text,
  p_data jsonb,
  p_archived boolean,
  p_expected_revision bigint,
  p_client_id text
)
returns table (
  applied boolean,
  reason text,
  id text,
  public_slug text,
  data jsonb,
  archived boolean,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orion_shows%rowtype;
  v_lock public.orion_show_locks%rowtype;
begin
  select l.* into v_lock
  from public.orion_show_locks as l
  where l.show_id = p_id
    and l.expires_at > clock_timestamp()
    and l.client_id <> p_client_id;

  select s.* into v_row
  from public.orion_shows as s
  where s.id = p_id
  for update;

  if found and v_lock.show_id is not null then
    return query select false, 'locked'::text, v_row.id, v_row.public_slug, v_row.data, v_row.archived, v_row.revision, v_row.updated_at;
    return;
  end if;

  if not found then
    if p_expected_revision <> 0 then
      return query select false, 'missing'::text, null::text, null::text, null::jsonb, null::boolean, null::bigint, null::timestamptz;
      return;
    end if;

    insert into public.orion_shows (id, public_slug, data, archived, revision, updated_at)
    values (p_id, p_public_slug, coalesce(p_data, '{}'::jsonb), coalesce(p_archived, false), 1, clock_timestamp())
    returning * into v_row;

    return query select true, 'saved'::text, v_row.id, v_row.public_slug, v_row.data, v_row.archived, v_row.revision, v_row.updated_at;
    return;
  end if;

  if v_row.revision <> p_expected_revision then
    return query select false, 'conflict'::text, v_row.id, v_row.public_slug, v_row.data, v_row.archived, v_row.revision, v_row.updated_at;
    return;
  end if;

  update public.orion_shows as s
  set data = coalesce(p_data, '{}'::jsonb),
      archived = coalesce(p_archived, false),
      revision = s.revision + 1,
      updated_at = clock_timestamp()
  where s.id = p_id
  returning s.* into v_row;

  return query select true, 'saved'::text, v_row.id, v_row.public_slug, v_row.data, v_row.archived, v_row.revision, v_row.updated_at;
end;
$$;

create or replace function public.orion_delete_show(
  p_id text,
  p_expected_revision bigint,
  p_client_id text
)
returns table (
  applied boolean,
  reason text,
  id text,
  public_slug text,
  data jsonb,
  archived boolean,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.orion_shows%rowtype;
  v_lock public.orion_show_locks%rowtype;
begin
  select s.* into v_row
  from public.orion_shows as s
  where s.id = p_id
  for update;

  if not found then
    return query select true, 'missing'::text, null::text, null::text, null::jsonb, null::boolean, null::bigint, null::timestamptz;
    return;
  end if;

  select l.* into v_lock
  from public.orion_show_locks as l
  where l.show_id = p_id
    and l.expires_at > clock_timestamp()
    and l.client_id <> p_client_id;

  if found then
    return query select false, 'locked'::text, v_row.id, v_row.public_slug, v_row.data, v_row.archived, v_row.revision, v_row.updated_at;
    return;
  end if;

  if v_row.revision <> p_expected_revision then
    return query select false, 'conflict'::text, v_row.id, v_row.public_slug, v_row.data, v_row.archived, v_row.revision, v_row.updated_at;
    return;
  end if;

  delete from public.orion_shows as s where s.id = p_id;
  return query select true, 'saved'::text, v_row.id, v_row.public_slug, v_row.data, v_row.archived, v_row.revision, v_row.updated_at;
end;
$$;

create or replace function public.orion_acquire_show_lock(
  p_show_id text,
  p_client_id text,
  p_device_label text,
  p_inactive_seconds integer default 0
)
returns table (
  acquired boolean,
  owner_client_id text,
  device_label text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock public.orion_show_locks%rowtype;
  v_remaining_seconds integer;
begin
  if not exists (select 1 from public.orion_shows as s where s.id = p_show_id) then
    return query select false, null::text, null::text, null::timestamptz;
    return;
  end if;

  delete from public.orion_show_locks as l
  where l.show_id = p_show_id and l.expires_at <= clock_timestamp();

  v_remaining_seconds := greatest(0, 600 - least(greatest(coalesce(p_inactive_seconds, 0), 0), 600));

  insert into public.orion_show_locks (show_id, client_id, device_label, expires_at, updated_at)
  values (
    p_show_id,
    p_client_id,
    coalesce(nullif(trim(p_device_label), ''), 'Otro dispositivo'),
    clock_timestamp() + make_interval(secs => v_remaining_seconds),
    clock_timestamp()
  )
  on conflict (show_id) do update
  set client_id = excluded.client_id,
      device_label = excluded.device_label,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  where public.orion_show_locks.client_id = excluded.client_id
     or public.orion_show_locks.expires_at <= clock_timestamp()
  returning * into v_lock;

  if found then
    return query select true, v_lock.client_id, v_lock.device_label, v_lock.expires_at;
    return;
  end if;

  select l.* into v_lock
  from public.orion_show_locks as l
  where l.show_id = p_show_id;

  return query select false, v_lock.client_id, v_lock.device_label, v_lock.expires_at;
end;
$$;

create or replace function public.orion_release_show_lock(
  p_show_id text,
  p_client_id text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  delete from public.orion_show_locks
  where show_id = p_show_id and client_id = p_client_id;
  select true;
$$;

revoke all on function public.orion_save_workspace(jsonb, bigint) from public;
revoke all on function public.orion_save_show(text, text, jsonb, boolean, bigint, text) from public;
revoke all on function public.orion_delete_show(text, bigint, text) from public;
revoke all on function public.orion_acquire_show_lock(text, text, text, integer) from public;
revoke all on function public.orion_release_show_lock(text, text) from public;

grant execute on function public.orion_save_workspace(jsonb, bigint) to anon, authenticated;
grant execute on function public.orion_save_show(text, text, jsonb, boolean, bigint, text) to anon, authenticated;
grant execute on function public.orion_delete_show(text, bigint, text) to anon, authenticated;
grant execute on function public.orion_acquire_show_lock(text, text, text, integer) to anon, authenticated;
grant execute on function public.orion_release_show_lock(text, text) to anon, authenticated;

-- Enable Realtime for shared data. The DO blocks keep this section idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orion_shows'
  ) then
    alter publication supabase_realtime add table public.orion_shows;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orion_workspace'
  ) then
    alter publication supabase_realtime add table public.orion_workspace;
  end if;
end $$;

-- Realtime DELETE events are filtered by public_slug (not the primary key) on
-- the public Show route, so orion_shows needs full old-row data on delete.
-- See supabase/migrations/202607150002_realtime_replica_identity.sql.
alter table public.orion_shows replica identity full;
