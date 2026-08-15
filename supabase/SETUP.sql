-- Ori♡n Shows · Supabase setup
-- Run this entire file in Supabase > SQL Editor.
--
-- The editor requires an authenticated account that is a member of
-- orion_app_users (D-215). The anon role may execute exactly one function,
-- orion_public_show(slug), which serves the public read-only route.
--
-- After running this file: disable e-mail signups in Authentication > Providers,
-- create the first account in Authentication > Users, then grant it membership:
--   select * from public.orion_add_member('tu@email.com', 'Tu Nombre', 'owner');

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

-- D-215: only authenticated members reach application data. The policies below
-- reference public.orion_is_member(), created further down in this file.
grant select, insert, update, delete on public.orion_workspace to authenticated;
grant select, insert, update, delete on public.orion_shows to authenticated;
grant select, insert, update, delete on public.orion_show_locks to authenticated;

revoke all on public.orion_workspace from anon;
revoke all on public.orion_shows from anon;
revoke all on public.orion_show_locks from anon;

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

-- Every function above is `security definer` and bypasses RLS, so these grants —
-- not the policies — are the real gate on them. Granting any of these to `anon`
-- would make the whole access model bypassable through the RPC.
grant execute on function public.orion_save_workspace(jsonb, bigint) to authenticated;
grant execute on function public.orion_save_show(text, text, jsonb, boolean, bigint, text) to authenticated;
grant execute on function public.orion_delete_show(text, bigint, text) to authenticated;
grant execute on function public.orion_acquire_show_lock(text, text, text, integer) to authenticated;
grant execute on function public.orion_release_show_lock(text, text) to authenticated;

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

-- ---------------------------------------------------------------------------
-- Authenticated editor access — phase 1 (additive).
-- Mirrors supabase/migrations/202608150003_auth_foundation.sql so a from-empty
-- bootstrap matches a migrated project. Nothing here revokes anonymous access;
-- that lands in a separate migration once login is verified in production.
-- ---------------------------------------------------------------------------
-- Member registry ------------------------------------------------------------
-- Authorisation is membership in this table, never a hardcoded email or UUID.
-- Adding a person is one INSERT; no code change and no redeploy.
create table if not exists public.orion_app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

alter table public.orion_app_users enable row level security;

revoke all on public.orion_app_users from anon;
grant select on public.orion_app_users to authenticated;

-- Membership predicate --------------------------------------------------------
-- `security definer` is load-bearing twice over. It lets the predicate read the
-- registry regardless of that table's own RLS, which both keeps the registry
-- unreadable by anon and avoids the classic infinite recursion of a policy on
-- orion_app_users that queries orion_app_users.
--
-- Membership rather than `auth.role() = 'authenticated'` is also load-bearing:
-- should e-mail signups ever be re-enabled by accident, a self-registered
-- stranger authenticates successfully but is still not a member, so every
-- policy below denies them.
create or replace function public.orion_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orion_app_users as u where u.user_id = auth.uid()
  );
$$;

revoke all on function public.orion_is_member() from public;
grant execute on function public.orion_is_member() to authenticated;

-- Members may read the registry (to attribute locks and, later, list people).
-- No insert/update/delete policy exists on purpose: the registry is mutable
-- only from the Supabase SQL editor, so a compromised browser session cannot
-- grant access to anyone else.
drop policy if exists "orion members read registry" on public.orion_app_users;
create policy "orion members read registry" on public.orion_app_users
  for select to authenticated
  using (public.orion_is_member());

-- Public read-only Show accessor ----------------------------------------------
-- Replaces the anonymous `select` over the whole orion_shows table that the
-- public route uses today. The visitor must present an exact slug, so the Show
-- catalogue can no longer be enumerated with the publishable key.
--
-- Archived Shows are returned deliberately: D-213 keeps the public link alive
-- through archiving and disables it only on delete.
create or replace function public.orion_public_show(p_slug text)
returns table (
  id text,
  public_slug text,
  data jsonb,
  archived boolean,
  revision bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.public_slug, s.data, s.archived, s.revision, s.updated_at
  from public.orion_shows as s
  where s.public_slug = p_slug
  limit 1;
$$;

revoke all on function public.orion_public_show(text) from public;
grant execute on function public.orion_public_show(text) to anon, authenticated;

-- Administrative helper --------------------------------------------------------
-- Resolves an e-mail to its auth user and records membership, so an operator
-- never has to copy a UUID by hand. Intentionally granted to no application
-- role: it is reachable only from the Supabase SQL editor, which runs as an
-- administrative role and bypasses these grants.
create or replace function public.orion_add_member(
  p_email text,
  p_display_name text,
  p_role text default 'owner'
)
returns public.orion_app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.orion_app_users%rowtype;
begin
  select u.id into v_user_id
  from auth.users as u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception
      'No existe un usuario de autenticación con el email %. Creálo primero en Authentication > Users.',
      p_email;
  end if;

  insert into public.orion_app_users as t (user_id, display_name, role)
  values (v_user_id, p_display_name, p_role)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        role = excluded.role
  returning t.* into v_row;

  return v_row;
end;
$$;

revoke all on function public.orion_add_member(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated editor access — phase 2 (member policies).
-- Mirrors supabase/migrations/202608150004_revoke_anonymous_access.sql. Placed
-- last because these policies call public.orion_is_member(), defined above.
-- ---------------------------------------------------------------------------
drop policy if exists "orion workspace member access" on public.orion_workspace;
create policy "orion workspace member access" on public.orion_workspace
  for all to authenticated
  using (public.orion_is_member())
  with check (public.orion_is_member());

drop policy if exists "orion shows member access" on public.orion_shows;
create policy "orion shows member access" on public.orion_shows
  for all to authenticated
  using (public.orion_is_member())
  with check (public.orion_is_member());

drop policy if exists "orion locks member access" on public.orion_show_locks;
create policy "orion locks member access" on public.orion_show_locks
  for all to authenticated
  using (public.orion_is_member())
  with check (public.orion_is_member());
