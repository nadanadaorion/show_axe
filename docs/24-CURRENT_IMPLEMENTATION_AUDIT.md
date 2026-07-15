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

- `tests/unit/store.test.ts` (15 tests): exercises `src/store.ts` directly with `src/lib/db.ts` and
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
- `applyPreset` onto an existing Show (5 tests, added in a follow-up coverage pass): merge mode adds Preset
  content without removing existing Equipment/People/Schedule, reuses a category matched by
  case-insensitive name instead of duplicating it, always resets `checked` to `false` on merged equipment,
  keeps the Show's own `showType`/`note`/Input List untouched, and skips a Preset person whose name already
  exists on the Show; replace mode fully overwrites Equipment/People/Schedule/Categories with remapped
  Preset content while preserving Show identity (id, public slug, name, date, time, archived, createdAt)
  and the existing (now out-of-sync but not deleted) Input List, and lets the Preset's own
  `showType`/`note` win when defined; both modes were verified to never share object references with the
  source Preset (mutating the resulting Show cannot affect the Preset); an empty Preset leaves the Show
  unchanged on merge and wipes Equipment/People/Schedule/Categories (while keeping the Show's own
  `showType`/`note`) on replace.
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

## Milestone 2 — shared-data hardening (this update)

Scope note: `src/lib/supabase.ts`, `src/lib/useShowLock.ts`, `src/components/SyncController.tsx`, and
`src/pages/PublicShowPage.tsx` already implemented the full shared-sync/lock/conflict/public-link feature
set in the baseline this repository started from — Milestone 2, per `CODEX_START_HERE.md` and
`docs/21-ROADMAP.md`, is "verify shared synchronization" / "shared-data hardening," not build it from
scratch. This update accordingly focuses on verification infrastructure and one real bug fix, not new
product features.

**Product fix:**

- `orion_shows` now uses `replica identity full`
  (`supabase/migrations/202607150002_realtime_replica_identity.sql`, folded into `supabase/SETUP.sql`).
  Found by code review: the public Show route's Realtime subscription filters `DELETE` events by
  `public_slug` (not the primary key); without full replica identity, Postgres does not include
  non-key old-row data in `DELETE` change events, so a visitor with a public Show page open would not
  learn about a deletion live (a reload still correctly 404s, since the initial fetch is unaffected).

**Verification infrastructure added** (see `docs/19-TESTING_STRATEGY.md` "Milestone 2" for full detail):

- `supabase/config.toml`, `.env.example` (documented `SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY`, no real
  credentials).
- `supabase/scripts/verify-sql-native.sh` + `assertions.sql`: applies migrations to a throwaway database
  twice from empty and self-checks 8 RPC/RLS behaviors. **Executed for real in this environment** (see
  "Milestone 0/1/2 verification" below for the exact run) since this sandbox's Docker daemon cannot pull
  images (confirmed `403`/policy denial pulling from Docker Hub), so `supabase start` could not run here.
- `tests/integration/` (5 files, 19 tests) using real `@supabase/supabase-js` calls against the actual
  RPC/table contract, and `tests/e2e/*.supabase.spec.ts` (3 files) for the browser-driven scenarios
  (two-device lock blocking, public link lifecycle, offline queue + conflict resolution both ways). All
  eight files self-skip cleanly (confirmed: exit 0, clear console message, zero hangs) when no reachable
  Supabase instance is configured — never a mock standing in for a real response. **Not executed against a
  real backend in this environment** (none was reachable); verified only for correct skip behavior,
  TypeScript types (`npm run typecheck:tests`), and Playwright collection (`npx playwright test --list`).
  They will run for real in the new `supabase-integration` CI job once this branch's CI executes, or
  locally with Docker available.
- `tests/unit/supabase.test.ts`, `tests/unit/syncQueue.test.ts` (real `fake-indexeddb`, not a mock of the
  queue's own logic), `tests/component/useShowLock.test.tsx` (lock hook state machine, `src/lib/supabase.ts`
  mocked) — all executed and passing now, no live backend needed.
- `scripts/check-no-secrets.sh` (`npm run check:secrets`) — executed for real; found no service-role/secret
  keys or JWT-shaped literals in the repo or a production `dist/` build (see "Milestone 0/1/2 verification").
- CI gained a `supabase-integration` job (real `supabase start` on GitHub-hosted runners, which — unlike
  this sandbox — can reach Docker Hub) plus `typecheck:tests` and `check:secrets` steps on the existing job.

**Deliberately not done, per explicit instruction:**

- Monitor-return output collision detection — still not implemented (see "Output collisions" below);
  remains an open decision.
- The Workspace conflict policy (`docs/25-DECISION_LOG.md`: "open decision requiring explicit approval") —
  `tests/integration/workspace.test.ts` tests and documents the *existing* local-last retry behavior
  exactly as implemented; no new field-level merge UI was built. `docs/21-ROADMAP.md`'s framing of this as
  something Milestone 2 should "decide and implement" conflicts with the decision log's open status; per
  `docs/00-SOURCE_OF_TRUTH.md`'s priority order the decision log wins. **This needs your explicit decision
  before any implementation.**
- No accounts/auth/invitations were added (none existed; not requested).

## Milestone 0/1/2 verification

The included repository was installed from a clean dependency state (`npm ci`) and the following commands
passed: `npm run lint`, `npm run test` (68 unit/component tests), `npm run typecheck:tests`, `npm run
build`, `npm run test:supabase:sql` (real, executed against a native Postgres — see "Milestone 2" above),
and `npm run check:secrets` (real — no secrets found in repo or `dist/`). `npm run test:integration` and the
`.supabase.spec.ts` E2E files correctly report 0 executed/skipped-with-reason when no Supabase instance is
reachable, which is the honest state of this environment; see "Milestone 2" above for why, and
`docs/19-TESTING_STRATEGY.md` for how to run them for real. Production build completed successfully with
Vite.

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

Executed and passing against a real (native, non-Supabase-CLI) Postgres in this environment — see
"Milestone 0/1/2 verification" below:

- migrations apply cleanly and idempotently from empty;
- RPC signatures, optimistic concurrency, lock acquire/block/heartbeat-renew/release/expiry, delete
  (and its idempotency), open anon RLS, `public_slug` uniqueness, replica identity.

Still not verified against the real Supabase platform (PostgREST, GoTrue absence, actual Realtime wire
delivery, `supabase start`'s own bootstrap) or a live project, because none was reachable in this
environment:

- Execution of `supabase/SETUP.sql`/migrations via `supabase start` or in a real Supabase project.
- Anonymous RLS behavior via the real PostgREST layer (only verified via direct SQL role-switching here).
- RPC request/response shapes as actually returned by PostgREST (only verified via direct SQL calls here).
- Actual Realtime delivery over the wire (channel/WebSocket behavior) — `tests/integration/realtime.test.ts`
  exists and is correct by review, but unexecuted.
- Two-device locks and the offline/conflict E2E flows through the real UI —
  `tests/e2e/lock-block.supabase.spec.ts` and `tests/e2e/offline-conflict.supabase.spec.ts` exist and are
  correct by review, but unexecuted.
- Public route against live data end-to-end through the UI — `tests/e2e/public-route.supabase.spec.ts`
  exists and is correct by review, but unexecuted.

These must be treated as unverified until the integration/E2E suites actually run against a reachable
Supabase instance (locally with Docker, or in this branch's CI once pushed).

## Missing automated quality controls

- Milestones 0, 1, and 2 (foundation; core business-rule coverage; shared-data hardening infrastructure)
  are implemented. The Supabase-backed integration/E2E suites are written, typed, and confirmed to skip
  cleanly, but have not actually been *run* against a real backend in this environment (see "Milestone 2"
  above) — that execution is the main outstanding verification step, not missing code.
- Playwright's Setup-screen smoke test and the three `.supabase.spec.ts` files exist (`npx playwright test
  --list` shows 7 specs across 4 files); only the Setup-screen ones have actually executed successfully so
  far. Item 8 from the Milestone 2 E2E list ("generate Input List and PDF") remains uncovered by E2E and is
  a reasonable Milestone 3 candidate.
- `supabase/VERIFY.sql` is now also wrapped in a self-checking, CI-runnable form
  (`supabase/scripts/assertions.sql` via `npm run test:supabase:sql`), executed for real in this
  environment. It is not yet wired into the default CI job (only the new `supabase-integration` job's
  `supabase start` bootstrap exercises the migrations for real; the native-Postgres script stays a local/CI
  fallback command, not a required gate, since it needs `psql` or a `DATABASE_URL`).
- CI runs lint, unit/component tests, typecheck of tests, build, and a secret scan on every push/PR
  (`build` job); a second `supabase-integration` job runs the real Supabase CLI stack and the gated
  integration/E2E suites, but its actual pass/fail is unknown until this branch's CI executes.

## Known design/implementation risks

### Open editor is not secure

Anonymous policies intentionally allow all data mutations. Public read-only mode is only a UI boundary.

### Workspace conflict policy

Shows receive explicit conflict resolution, but Workspace conflicts currently retry with the local Workspace over the latest revision. Concurrent Library/Preset/Preferences edits can overwrite remote changes without a user comparison. This exact behavior is now tested and documented
(`tests/integration/workspace.test.ts`), not changed — it remains an **open decision** per
`docs/25-DECISION_LOG.md` requiring your explicit approval before either formalizing it as-is or replacing
it with field-level merge/conflict UI.

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

Milestones 0, 1, and 2 from `CODEX_START_HERE.md` are implemented; see the sections above for exact results
and remaining risk. Before Milestone 3:

1. Run `npm run test:integration` and `npm run test:e2e` for real against a reachable Supabase instance
   (locally with Docker via `supabase start`, or by letting this branch's CI run) and fix anything they
   reveal — they were verified for correctness by review and type-checking only, never executed here.
2. Get an explicit decision on the open Workspace conflict policy (see "Workspace conflict policy" above).
3. Decide on the two open items already flagged: monitor-return output collision handling, and
   permanent-delete-versus-Undo semantics after remote sync (`docs/25-DECISION_LOG.md`).

Only after that, proceed to Milestone 3 (UX/resilience: modal accessibility, keyboard alternatives, mobile
technical-table behavior, Service Worker update flow, structured error recovery, PDF bundle
code-splitting). Do not add new product features before the existing candidate is verified.
