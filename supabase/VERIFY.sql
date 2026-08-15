-- Ori♡n Shows V2 verification. Safe read-only checks except the transaction-scoped test below.

-- 1. Tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('orion_workspace', 'orion_shows', 'orion_show_locks', 'orion_app_users')
order by table_name;

-- 2. RLS status
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('orion_workspace', 'orion_shows', 'orion_show_locks', 'orion_app_users')
order by relname;

-- 3. Policies. Expected: every `roles` column reads {authenticated}. Any policy still
--    listing `anon` means the editor is reachable without a session (D-215).
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('orion_workspace', 'orion_shows', 'orion_show_locks', 'orion_app_users')
order by tablename, policyname;

-- 3b. Anonymous access audit. THIS IS THE ONE THAT MATTERS. Expected: exactly one
--     row, orion_public_show, which serves the public read-only route and requires
--     an exact slug (D-219). Anything else listed here is reachable by anyone
--     holding the publishable key, which is public by construction.
select 'table' as kind, t.table_name as object, p.privilege as detail
from (values ('orion_shows'), ('orion_workspace'), ('orion_show_locks'), ('orion_app_users')) as t(table_name)
cross join (values ('select'), ('insert'), ('update'), ('delete')) as p(privilege)
where has_table_privilege('anon', format('public.%I', t.table_name), p.privilege)
union all
select 'function', f.signature, 'execute'
from (values
  ('public.orion_save_workspace(jsonb, bigint)'),
  ('public.orion_save_show(text, text, jsonb, boolean, bigint, text)'),
  ('public.orion_delete_show(text, bigint, text)'),
  ('public.orion_acquire_show_lock(text, text, text, integer)'),
  ('public.orion_release_show_lock(text, text)'),
  ('public.orion_add_member(text, text, text)'),
  ('public.orion_public_show(text)')
) as f(signature)
where has_function_privilege('anon', f.signature, 'execute')
order by kind, object;

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
    'orion_release_show_lock',
    'orion_public_show',
    'orion_is_member',
    'orion_add_member'
  )
order by p.proname;

-- 5. Realtime publication
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('orion_workspace', 'orion_shows')
order by tablename;

-- 6. Replica identity: orion_shows must be FULL so a Realtime DELETE event
--    carries public_slug (a non-primary-key column), which the public Show
--    route filters on. Expected: replica_identity = 'full'.
select relname as table_name,
  case relreplident when 'd' then 'default' when 'f' then 'full' when 'n' then 'nothing' when 'i' then 'index' end as replica_identity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname = 'orion_shows';

-- 7. Transaction-scoped optimistic-write smoke test; rolls back all test data.
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
