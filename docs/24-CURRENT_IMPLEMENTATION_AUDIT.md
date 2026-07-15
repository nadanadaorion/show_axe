# Current implementation audit

Audit date: 2026-07-15.

## Milestone 0 — test foundation (this update)

Added without changing product behavior:

- Vitest (`vitest.config.ts`, jsdom environment) with React Testing Library, `@testing-library/jest-dom`,
  and `@testing-library/user-event` for unit/component tests.
- Playwright (`playwright.config.ts`) for end-to-end tests, currently limited to the deterministic Setup
  screen smoke path since no live Supabase project is available in this environment.
- Deterministic fixture builders (`tests/fixtures/builders.ts`) for Show, Equipment, Input List, Workspace,
  Preset, and both conflict shapes.
- Initial unit tests for `src/lib/inputList.ts` and `src/lib/utils.ts`, and a component test for
  `src/components/ErrorBoundary.tsx`, to prove each test layer works end-to-end against real domain code.
- `npm run test`, `npm run test:watch`, and `npm run test:e2e` scripts.
- `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm run test`, and `npm run build` on every
  push and pull request.
- A documented disposable-Supabase workflow for future integration tests (`docs/19-TESTING_STRATEGY.md`).
- A `.gitignore` (none existed previously), covering `node_modules/`, `dist/`, and test-tool output
  directories so they are never accidentally committed.

Exact verification results for this change are recorded in the "Milestone 0 verification" section below.

## Milestone 1 — business-rule coverage (this update)

Tests only; no product code changed. Added:

- `tests/unit/store.test.ts` (10 tests): exercises `src/store.ts` directly with `src/lib/db.ts` and
  `src/lib/syncQueue.ts` mocked, covering — Library edits never mutate already-copied Show equipment/
  people, even after the Library source is renamed or deleted; Preset edits/deletion never mutate a Show
  already created from that Preset; equipment quantity changes keep assignments consistent through the
  real `updateEquipment` action (earliest assignments preserved on shrink, blank ones appended on grow);
  `duplicateShow` gives every entity a new id (categories, equipment, assignments, people, schedule, Input
  List rows/returns) and correctly remaps Input List provenance to the new equipment/assignment ids while
  leaving the manual row's own id-less content untouched, and clears archived state on the copy; `archiveShow`
  preserves the public slug across archive/restore; `deleteShow` removes the Show locally and queues a
  `show-delete` mutation (not a fresh upsert); `importSnapshot` merge preserves non-colliding local data and
  lets incoming data win on id collisions, replace discards local data absent from the import.
- `tests/unit/inputList.test.ts`: one added regression test for decision D-114 ("reordering or
  synchronization must not overwrite custom CH") — a retained row's manually set channel survives
  `previewInputListSync` even when far outside the sequential numbering range.
- `docs/19-TESTING_STRATEGY.md` updated with exact coverage and the two items deliberately left uncovered
  (see below).

Deliberately not covered by Milestone 1:

- Monitor-return output collision validation — the product does not implement this check yet (see "Output
  collisions" below); writing a test for it would mean adding new behavior, which is out of scope for a
  tests-only milestone.
- Full remote-deletion confirmation for "delete removes the public record" — verified only that the Show
  disappears from local state and a `show-delete` mutation is queued; confirming the Supabase row is
  actually deleted needs a live/local Supabase instance (Milestone 2).

Full business-rule coverage of sync/lock/conflict flows and live Supabase integration/E2E coverage
(Milestone 2) are not yet implemented.

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

- Milestone 0 (foundation) and Milestone 1 (core business-rule coverage: snapshot isolation, equipment
  consistency, duplication id remapping, archive/delete, JSON import merge/replace) are implemented. Still
  missing: sync/lock/conflict flows end-to-end, and Preset apply (merge/replace) behavior at the Show
  level, which need either a live/local Supabase instance or further Milestone-1-style store tests if a
  future milestone extends this scope.
- Playwright is configured, but only a Setup-screen smoke test exists; the full E2E suite in
  `docs/19-TESTING_STRATEGY.md` (two-device locks, conflicts, public routes, PDF export) is not yet
  implemented and requires a live or local Supabase instance (Milestone 2).
- No SQL verification test run in CI (`supabase/VERIFY.sql` exists but is not wired into an automated job).
- CI runs lint, unit/component tests, and build on every push/PR; it does not yet run Playwright or any
  Supabase-backed integration job.

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

### Form label association

`components/ui.tsx`'s `Label` renders a `<label>` with no `htmlFor`, and callers do not pass matching
`id`s to `Input`/`Textarea`, so labels are not programmatically associated with their fields (confirmed via
the Setup screen Playwright smoke test, which had to fall back to placeholder-based locators instead of
`getByLabel`). This affects screen reader users and is in scope for the Milestone 3 accessibility audit.

## Recommended next action

Milestone 0 (test foundation) and Milestone 1 (core business-rule coverage) from `CODEX_START_HERE.md` are
implemented; see the sections above for exact results and remaining risk. Proceed to Milestone 2: verify
shared synchronization (clean initial pull, offline queue/reconnect, revision conflicts, lock lifecycle,
Realtime/periodic-sync fallback, workspace concurrent edits) against a disposable Supabase project or local
stack, per the workflow documented in `docs/19-TESTING_STRATEGY.md`. Do not add new product features before
the existing candidate is verified.
