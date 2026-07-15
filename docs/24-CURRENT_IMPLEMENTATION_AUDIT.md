# Current implementation audit

Audit date: 2026-07-15.

## Verified in this package

The included repository was installed from a clean dependency state and the following commands passed:

```bash
npm install --no-audit --no-fund
npm run lint
npm run build
```

Production build completed successfully with Vite.

## Implemented source areas

- React editor and public routing.
- Error Boundary.
- Shows list/create/duplicate/archive/delete/restore.
- Show Equipment, People, Information, and Schedule.
- Library and Presets.
- Preferences and JSON/backups.
- Grouped equipment quantities with per-unit assignments.
- Input List modal.
- generated/manual rows;
- update preview preserving manual edits;
- custom CH and explicit renumbering;
- monitor returns;
- portrait/landscape PDF export.
- Dexie V2 local database.
- pending mutation queue.
- Supabase fetch/RPC/Realtime layer.
- Show conflict modal with local/online choices.
- Show lock hook with activity heartbeat and expiry.
- public read-only Show route.
- Service Worker offline shell.
- idempotent Supabase setup SQL.

## Build warnings

The build reports:

1. `config.js` is a non-module runtime script and therefore is not bundled. This is intentional but should be documented/tested.
2. Main JavaScript and PDF-related chunks exceed Vite's default 500 kB warning threshold. Code splitting is recommended.

## Not verified against a live external service

- Execution of `supabase/SETUP.sql` in a real Supabase project.
- Anonymous RLS behavior in that project.
- RPC signatures and return payloads under the current Supabase platform.
- Realtime delivery.
- Two-device locks.
- Offline conflict resolution after an actual network transition.
- Public route against live data.

These must be treated as unverified until integration/E2E tests pass.

## Missing automated quality controls

- No unit tests.
- No component tests.
- No Playwright/E2E tests.
- No SQL verification test.
- CI has been added by this handoff package, but tests must still be implemented.

## Known design/implementation risks

### Open editor is not secure

Anonymous policies intentionally allow all data mutations. Public read-only mode is only a UI boundary.

### Workspace conflict policy

Shows receive explicit conflict resolution, but Workspace conflicts currently retry with the local Workspace over the latest revision. Concurrent Library/Preset/Preferences edits can overwrite remote changes without a user comparison.

### Delete Undo and remote identity

The editor offers local Show Undo. Remote deletion and public slug restoration semantics need an E2E test to ensure Undo does not create a misleading or inconsistent public link state.

### Service Worker update lifecycle

Caching exists, but there is no visible update-available flow. A stale tab may continue using an old asset set until reload.

### Bundle size

PDF dependencies and the main bundle are large. Dynamic imports should isolate PDF generation and possibly Supabase-heavy paths.

### Validation

The domain relies primarily on TypeScript and normalization functions. Imported JSON and remote JSON should use runtime schema validation.

### Backup retention

Automatic backup creation exists, but retention/capping must be verified to avoid unbounded IndexedDB growth.

### Output collisions

Stereo monitor output labels are calculated, but explicit collision validation should be added and tested.

## Recommended next action

Implement Milestone 0 from `CODEX_START_HERE.md`: test foundation, fixtures, CI validation, and a documented disposable Supabase integration environment. Do not add new product features before the existing candidate is verified.
