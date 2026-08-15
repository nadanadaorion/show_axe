# Supabase and database specification

## Fresh project procedure

1. Create a new Supabase project and wait for it to become healthy.
2. Open SQL Editor and run all of `supabase/SETUP.sql`, or run `supabase start` locally so the timestamped migrations apply from empty.
3. Run `supabase/VERIFY.sql`; do not deploy if an assertion fails.
4. In **Connect**, copy the Project URL and publishable key (or legacy anon key).
5. Configure only those two public values. Never request a secret/service-role key.
6. Run integration and browser tests against this disposable instance before production use.

The automated suites create and delete records. Never point them at a production workspace.

## Tables

### `public.orion_workspace`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Must equal `main`. |
| `data` | jsonb | WorkspaceData. |
| `revision` | bigint | Optimistic concurrency revision. |
| `updated_at` | timestamptz | Server timestamp. |

### `public.orion_shows`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Client-generated Show ID. |
| `public_slug` | text unique | Public route slug. |
| `data` | jsonb | Complete Show. |
| `archived` | boolean | Duplicated for query convenience. |
| `revision` | bigint | Optimistic concurrency revision. |
| `updated_at` | timestamptz | Server timestamp. |

### `public.orion_show_locks`

| Column | Type | Notes |
|---|---|---|
| `show_id` | text PK/FK | Cascade delete with Show. |
| `client_id` | text | Browser installation identity. |
| `device_label` | text | Browser/OS label. |
| `expires_at` | timestamptz | Automatic expiry. |
| `updated_at` | timestamptz | Heartbeat timestamp. |

## RPC functions

- `orion_save_workspace(data, expected_revision)`
- `orion_save_show(id, public_slug, data, archived, expected_revision, client_id)`
- `orion_delete_show(id, expected_revision, client_id)`
- `orion_acquire_show_lock(show_id, client_id, device_label, inactive_seconds)`
- `orion_release_show_lock(show_id, client_id)`

All functions must be idempotently created by migration SQL and use an explicit safe `search_path`.

## Access model

D-215 replaces the original open anonymous model with authenticated editor access. The migration is staged,
so a project may currently be in either state.

**Phase 1 (`202608150003_auth_foundation.sql`, additive).** Adds the `orion_app_users` registry, the
`orion_is_member()` predicate, the `orion_public_show(slug)` accessor and the dashboard-only
`orion_add_member(email, display_name, role)` helper. It revokes nothing, so existing anonymous access and
all current behaviour are unchanged. Safe to apply to a live project before the client can log in.

**Phase 2 (revocation, later migration).** Moves table policies and every mutating RPC grant from `anon` to
`authenticated`, gated on `orion_is_member()`, leaving `orion_public_show` as the only function anonymous
visitors may execute.

Applying phase 2 before a verified login is deployed would lock the running application out of its own data.

Two properties are load-bearing and must survive any future edit:

- **RPC grants are the real gate.** Every RPC is `security definer` and therefore bypasses RLS entirely.
  Tightening the table policies while leaving an `execute` grant to `anon` would leave the whole scheme
  bypassable through the RPC.
- **Authorisation is membership, not authentication.** Policies test `orion_is_member()`, so a stranger who
  self-registers — should signups ever be re-enabled by accident — authenticates but is still denied.

No secret/service-role key may be used in the browser. Signups must remain disabled in
Authentication → Providers → Email.

### `orion_app_users`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK/FK | References `auth.users`, cascade delete. |
| `display_name` | text | Shown for lock attribution. |
| `role` | text | `owner`/`editor`/`viewer`. Present from the outset; not yet differentiated by policy. |
| `created_at` | timestamptz | Creation time. |

Members may `select` the registry. There is deliberately no insert/update/delete policy: it is mutable only
from the SQL editor, so a compromised browser session cannot grant access to anyone else.

## Realtime

`orion_shows` and `orion_workspace` are added to `supabase_realtime`. Lock state may be polled/RPC-driven unless a later decision adds lock Realtime events.

`orion_shows` uses `replica identity full`. The public Show route filters Realtime `DELETE` events by `public_slug`, a non-primary-key column; Postgres only includes non-key old-row data in the change feed when replica identity is `full`, so without it a live public page would not learn about a deletion until the visitor reloads (the initial fetch still correctly 404s). See `supabase/migrations/202607150002_realtime_replica_identity.sql`.

## Migrations

- Never edit production data structures only through the dashboard.
- Add timestamped SQL migrations under `supabase/migrations/`.
- Keep `supabase/SETUP.sql` as a reproducible latest-state bootstrap or generate it from migrations.
- Every migration must be rerunnable safely where practical.
- Document backward compatibility and rollback.

## Verification queries

A verification script should confirm:

- three tables exist;
- RLS is enabled;
- expected policies exist;
- RPC signatures exist;
- Realtime publication contains required tables;
- `orion_shows` replica identity is `full`;
- a test optimistic insert/update conflict behaves correctly;
- lock acquisition and expiry behave correctly.

`supabase/VERIFY.sql` is the deployed-project check. CI additionally starts Supabase from empty, applies
`supabase/migrations/202607150001_initial_v2.sql` and
`supabase/migrations/202607150002_realtime_replica_identity.sql`, then exercises PostgREST, RPC and
Realtime through the integration/E2E suites.

## Data integrity expectations

- `public_slug` unique.
- revisions increase exactly once per successful write.
- lock FK cascade removes lock on Show deletion.
- writes blocked by another active lock return `locked` rather than mutating.
- a revision mismatch returns current remote row for conflict UI.
