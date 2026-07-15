-- Ori♡n Shows V2 verification. Safe read-only checks except the transaction-scoped test below.

-- 1. Tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('orion_workspace', 'orion_shows', 'orion_show_locks')
order by table_name;

-- 2. RLS status
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('orion_workspace', 'orion_shows', 'orion_show_locks')
order by relname;

-- 3. Policies
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('orion_workspace', 'orion_shows', 'orion_show_locks')
order by tablename, policyname;

-- 4. RPC signatures
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'orion_save_workspace',
    'orion_save_show',
    'orion_delete_show',
    'orion_acquire_show_lock',
    'orion_release_show_lock'
  )
order by p.proname;

-- 5. Realtime publication
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('orion_workspace', 'orion_shows')
order by tablename;

-- 6. Transaction-scoped optimistic-write smoke test; rolls back all test data.
begin;

select * from public.orion_save_show(
  'verify-show',
  'verify-public-slug',
  '{"id":"verify-show","publicSlug":"verify-public-slug","name":"Verification","archived":false,"equipmentCategories":[],"equipment":[],"people":[],"schedule":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb,
  false,
  0,
  'verify-client'
);

-- Expected: applied=false, reason=conflict because revision 0 is now stale.
select * from public.orion_save_show(
  'verify-show',
  'verify-public-slug',
  '{"id":"verify-show","publicSlug":"verify-public-slug","name":"Stale write","archived":false,"equipmentCategories":[],"equipment":[],"people":[],"schedule":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb,
  false,
  0,
  'verify-client'
);

select * from public.orion_acquire_show_lock('verify-show', 'verify-client', 'Verification device', 0);

-- Expected: acquired=false for a different client while active.
select * from public.orion_acquire_show_lock('verify-show', 'verify-other-client', 'Other device', 0);

rollback;
