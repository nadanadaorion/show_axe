# Supabase and database specification

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

## Open access model

RLS is enabled, but policies allow anonymous read/write access deliberately. Grants expose table operations and approved RPCs to `anon` and `authenticated`.

No secret/service-role key may be used in the browser.

## Realtime

`orion_shows` and `orion_workspace` are added to `supabase_realtime`. Lock state may be polled/RPC-driven unless a later decision adds lock Realtime events.

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
- a test optimistic insert/update conflict behaves correctly;
- lock acquisition and expiry behave correctly.

## Data integrity expectations

- `public_slug` unique.
- revisions increase exactly once per successful write.
- lock FK cascade removes lock on Show deletion.
- writes blocked by another active lock return `locked` rather than mutating.
- a revision mismatch returns current remote row for conflict UI.
