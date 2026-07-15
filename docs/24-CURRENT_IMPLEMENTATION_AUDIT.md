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
  They later ran for real in GitHub Actions; see "Corrective status after first real CI run" below.
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
- The Workspace conflict policy — at the time this Milestone 2 PR was written, this was an open decision
  (`docs/25-DECISION_LOG.md`), so `tests/integration/workspace.test.ts` tested and documented the *existing*
  local-last retry behavior exactly as implemented; no new field-level merge UI was built.
  **Since resolved and implemented**: D-214 (`docs/25-DECISION_LOG.md`) approved a remote-wins policy,
  replacing local-last retry — see `docs/14-SYNC_OFFLINE_AND_LOCKS.md` "Workspace conflicts". Milestone 2.1
  implemented this in code (`src/lib/workspaceSync.ts`'s `processWorkspaceMutation`) and tests
  (`tests/e2e/workspace-conflict.supabase.spec.ts`, real two-client Supabase scenario), merged to `main`
  before Milestone 3 began. Milestone 3 did not touch this policy.
- No accounts/auth/invitations were added (none existed; not requested).

## Milestone 2.1 — Workspace remote-wins (retroactive note)

Between Milestone 2 and Milestone 3, a separate PR implemented D-214 (Workspace remote-wins conflict
resolution) in code, merged to `main` before Milestone 3 started. This audit file was not updated at the
time; the stale "pending" language above and in "Workspace conflict policy" below has been corrected as
part of this Milestone 3 update. No Milestone 2.1 code was touched in Milestone 3.

## Milestone 3 — UX and resilience (this update)

Scope: `docs/21-ROADMAP.md` / `CODEX_START_HERE.md` Milestone 3 — modal accessibility, keyboard ordering
alternatives, mobile technical-table behavior, Service Worker update flow, structured error recovery, and
PDF bundle performance/code-splitting. Supabase sync, the Workspace remote-wins policy, Show conflicts,
locks, accounts/auth, Input List business rules, and PDF functional content were explicitly out of scope
and were not modified.

### Corrective status after first real CI run

GitHub Actions run `29426947786` executed the branch against a real local Supabase stack. The `build` job
passed; integration passed 22/22 with zero skips; Playwright ended 7 passed / 5 failed / 0 skipped after
all five failures exhausted two retries. Therefore Milestone 3 is **not yet accepted**. The corrective
changes in this branch address the real-Chromium focus failure, the Chromium/WebKit mobile configuration
mismatch, and the offline-status race, plus the cache-version and polling-cleanup risks found during
handoff. Local gates pass, but this status must not be changed to complete until a later CI run is wholly
green without retry-dependent passes.
The corrective run uses `retries: 0` so first-attempt stability is enforced by configuration.

Corrective run `29441798211` subsequently passed the build job and all 22 integration tests, but E2E was
still 7 passed / 5 failed with zero retries. Crucially, mobile Chromium did launch and the failure
artifacts were uploaded. Two public annotations showed the create-Show modal footer overlapping its
scrollable body and intercepting pointer events at 375×667. The follow-up changes the dialog to a flex
column with an independently scrolling body and fixed, non-overlapping header/footer, and adds an
always-on real-browser regression in `tests/e2e/modal-layout.mobile.spec.ts`.

Two subsequent runs showed that layout alone was not the remaining source of instability: the exact
mobile specs passed locally, while CI's `fullyParallel` execution broadcast other tests' Show writes into
the open modal and eventually also failed the otherwise-green singleton Workspace scenario. Because the
test stack intentionally has one Workspace row and one shared Realtime stream, configured-Supabase E2E
runs now use one worker. This is test isolation, not a retry or timeout workaround; desktop/mobile remain
separate projects and `retries: 0` is unchanged.

Further real-browser reproduction exposed two additional details. Mobile Chromium does not guarantee
that tapping a button focuses it, so the modal now records the last pointer trigger while closed and uses
it ahead of `activeElement` for exact restoration; keyboard opening still falls back to the focused
control. Also, `Button size="icon"`'s 36×36 utilities won over the nominal `h-11 w-11` classes in generated
CSS. Important size overrides now enforce 44×44 on mobile and 32×32 from `sm` upward. The offline E2E no
longer turns its status assertion into an accidental lazy-chunk precache test: it reads the persistent
sidebar badge and confirms the edited Show value in Supabase after reconnect.

Corrective run `29444552586` passed 10/13 Playwright cases, including offline and desktop focus. Only the
three mobile cases failed: the diagnostic hit-test passed, then Playwright's locator auto-scroll shifted
the layout before its mouse-style click. The mobile specs now perform a genuine Chromium touchscreen tap
at the already-verified unobstructed center. They do not use `force`, synthetic DOM `.click()`, retries, or
longer timeouts.

Run `29444981721` improved to 12/13. Its downloaded failure artifact identified the final case before any
interaction: accumulated long Show names made grid items retain their intrinsic minimum width, producing
108 px of horizontal overflow at 375 px. Show cards now set `min-w-0 w-full`; the always-on mobile test
seeds six long names and verifies the list remains at zero page-level overflow.

Run `29445373190` proved that overflow fix and remained at 12/13. The retained Equipment snapshot showed
only `Multicable`: the test had issued its second local-first edit before `Consola digital` settled in the
backend. The scenario now polls the actual Supabase Show after each addition and starts reorder only once
both names are remote; no production sync logic or protected Supabase behavior was changed.

Run `29445750738` retained two contexts showing the non-cancelable Show-conflict modal: polling the remote
row did not ensure the browser had applied the returned revision before the next edit. Mobile scenarios
now wait for the observable `Sincronizando…` then `Guardado en línea` cycle after creation and each add.
No conflict policy, sync queue, Supabase code, retry count, or fixed delay was changed.

**A. Modal accessibility + form label association** — `src/components/ui.tsx`'s `Modal` was rewritten:
`role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the title, a focus trap (`Tab`/`Shift+Tab`
cycle within the dialog), initial focus moved into the dialog on open (respecting native `autoFocus`), focus
restored to the triggering element on close, `Escape` closes only when a new `closeOnEscape` prop (default
`true`) allows it — the Show-conflict modal in `SyncController.tsx` sets `closeOnEscape={false}` since it is
non-cancelable by design. The app root (`#root`) gets the `inert` attribute while a modal is open, blocking
keyboard/pointer access to the background; the modal itself renders via `createPortal` into a new
`#modal-root` element (added to `index.html`) specifically so it is not `inert`-ed by its own mechanism. A
dev-only `console.warn` fires if more than one modal is open at once (no auto-close — the codebase does not
have a single `activeModal` state to safely close from). A new `Field` component (`useId()` + `cloneElement`
onto a single child) associates every genuinely 1:1 label/field pair across Setup, Shows, Show
(Equipment/People/Info/Schedule), Library, Presets, Settings, and the Input List modal; `Label` remains only
for non-1:1 headings (radio groups, `MultiSelect`). Validation errors (e.g. Setup screen) use `role="alert"`.
Focus restoration now removes `inert` first, waits until portal teardown on the next animation frame, and
only focuses the exact saved trigger when it remains connected, focusable, and outside any inert tree.
Tests cover Escape, action-button closure, and pointer activation without focus in jsdom; the desktop
smoke covers Escape and header-button closure in real Chromium. Tests: `tests/component/Modal.test.tsx`
(10 tests).

**B. Keyboard alternative to Equipment drag & drop** — Equipment is the only module in the codebase that
used drag & drop (`grep -rl draggable src/` returns only `ShowPage.tsx`; People and Schedule rows already
had non-drag reorder controls). `EquipmentRow` gained "Subir"/"Bajar" icon buttons (disabled at list
boundaries) that call the existing `moveEquipment` store action using a fractional-order trick
(`neighbor.order ± 0.5`) so the same reindexing logic used by drag & drop runs unchanged, plus a "Mover a
categoría" `Select` (shown when there is more than one category) for cross-category moves without a drag
gesture. Drag & drop itself was not removed. Both paths show the same "Equipo movido" / `Movido a "X"` toast
feedback. Tests: `tests/component/EquipmentReorder.test.tsx` (3 tests, real Zustand store, no mocking of
`moveEquipment`) plus keyboard-navigation assertions in the new E2E smoke specs. The 44×44 mobile
utilities use important overrides because the base icon button's 36×36 rule otherwise wins in Tailwind's
generated CSS order.

**C. Mobile-responsive Equipment/Input List** — Equipment was already a responsive card list (Tailwind
`sm:`/`lg:` breakpoints collapse expanded-row fields to one column below `sm`), not a rigid table; verified
in a real mobile-viewport (375×667) browser session with no page-level horizontal overflow, collapsed and
expanded. The Equipment reorder buttons now expose a 44×44 CSS px (`h-11 w-11`) mobile hit area while
keeping a smaller 32×32 desktop layout and the same accessible names/icons; the mobile smoke measures this
bounding box directly. The Input List's CH/Uso/Equipo/48V/Patch/Notas table
already used the authorized "horizontal scroll" adaptive pattern (`overflow-x-auto` wrapper, `min-w-[1050px]`
inner grid) rather than squeezing columns — confirmed for real: the wrapper (not the page) scrolls, every
column including the rightmost "Notas" field remains reachable and editable after scrolling, and custom CH
editing works. A `mobile` Playwright project (explicit Chromium, 375×667, touch/mobile emulation,
`**/*.mobile.spec.ts`) was added
alongside the existing desktop `chromium` project. Tests: `tests/e2e/equipment-inputlist.mobile.spec.ts`,
`tests/e2e/smoke-mobile.mobile.spec.ts` (real Supabase, gated like the existing `.supabase.spec.ts` files).

**D. Service Worker update flow** — see "Service Worker update lifecycle" above.

**E. Structured error recovery** — `ErrorBoundary` stays a class component (`getDerivedStateFromError`/
`componentDidCatch`) but is now driven by props (`onPrimaryAction`, `primaryActionLabel`, `title`,
`description`, `showExportBackup`) instead of being hardcoded, so it never shows a raw error message or
stack trace to the user (technical details go to `console.error`; a dev-only `<details>` disclosure is
gated behind `import.meta.env.DEV`). Every instance offers "Reintentar" (resets local state, re-renders the
same subtree — no reload) and "Recargar aplicación"; the "Volver a Shows" (or contextual equivalent) action
and an optional "Exportar respaldo" (global boundary only) are supplied by the wrapper. Two functional
wrappers supply navigation: `RouteErrorBoundary` uses `useNavigate()` (available since it always renders
inside the Router) for the Shows/ShowPage/Library/Presets/Settings routes and the public Show route;
`GlobalErrorBoundary` wraps the whole app in `App.tsx` *outside* the Router (it also wraps `SetupPage` and
the conditional `<HashRouter>` itself), so it cannot call `useNavigate()` and instead sets `location.hash =
'#/shows'` followed by a full reload — the documented last-resort fallback — and is the only boundary with
`showExportBackup`. A dedicated boundary wraps the Input List module specifically (`ShowPage.tsx`), so an
Input List failure closes only that modal and leaves the rest of the Show usable; PDF export handles its
own errors locally via try/catch instead of a boundary (see "F" below). Backup export is wrapped in
try/catch: on failure it shows an inline `role="alert"` message and keeps "Volver a Shows"/"Recargar
aplicación" available, never deletes local data, and never retries automatically. Tests:
`tests/component/ErrorBoundary.test.tsx` (12 tests covering the base component, `RouteErrorBoundary`, and
`GlobalErrorBoundary`, including the backup-export failure path and a rejected lazy-route import reaching
route recovery without any production crash route).

**F. PDF performance/code-splitting** — see "Bundle size" above for the route/vendor splitting. The PDF
export button in `InputListModal.tsx` now shows a loading state ("Generando…", disabled, spinning icon)
while the dynamic `import()` and generation run, and a toast plus `console.error` instead of a silent
failure if generation throws — the actual PDF content/layout logic in `src/lib/inputListPdf.ts` (portrait
and landscape, custom Input List numbering) was not touched. Tests: `tests/component/InputListPdf.test.tsx`
(3 tests: dynamic-import call with the selected orientation, loading state, error recovery).

**G. Desktop + mobile smoke tests** — `tests/e2e/smoke-desktop.supabase.spec.ts` (desktop `chromium`
project) and `tests/e2e/smoke-mobile.mobile.spec.ts` (`mobile` project) cover Shows listing, opening a Show,
Equipment, Input List, a modal (accessible role/name, `Escape`-close, focus return), and keyboard-only
reordering, against a real Supabase backend, gated the same way as the existing `.supabase.spec.ts` files
(skip with a clear message locally when unconfigured; fail loud in CI via `SUPABASE_INTEGRATION_REQUIRED`).
No visual/snapshot tests were added, per the Milestone 3 authorization — all assertions are role/name/
focus/state-based. The error-recovery screen and the Service Worker update notice are covered by real DOM
interaction at the component-test level (`ErrorBoundary.test.tsx`, `UpdateNotice.test.tsx`,
`useServiceWorkerUpdate.test.ts`) rather than a from-scratch E2E crash trigger, since there is no existing,
authorized way to deliberately force a production render crash from outside the app without adding
test-only surface area to shipped code; the Service Worker update flow was additionally verified once with
a real build/serve/version-bump browser round-trip (not part of the committed automated suite).

## Milestone 0/1/2 verification

The included repository was installed from a clean dependency state (`npm ci`) and the following commands
passed: `npm run lint`, `npm run test` (68 unit/component tests), `npm run typecheck:tests`, `npm run
build`, `npm run test:supabase:sql` (real, executed against a native Postgres — see "Milestone 2" above),
and `npm run check:secrets` (real — no secrets found in repo or `dist/`). `npm run test:integration` and the
`.supabase.spec.ts` E2E files correctly report 0 executed/skipped-with-reason when no Supabase instance is
reachable, which is the honest state of this environment; see "Milestone 2" above for why, and
`docs/19-TESTING_STRATEGY.md` for how to run them for real. Production build completed successfully with
Vite.

## Milestone 3 verification

Re-run from a clean dependency state (`npm ci`) in this environment: `npm run lint`, `npm run test` (115
unit/component tests: 10 in `tests/component/Modal.test.tsx`, 3 in
`tests/component/EquipmentReorder.test.tsx`, 12 in `tests/component/ErrorBoundary.test.tsx`, 7 in
`tests/unit/useServiceWorkerUpdate.test.ts`, 3 in `tests/unit/serviceWorker.test.ts`, 3 in
`tests/component/UpdateNotice.test.tsx`, and 3 in `tests/component/InputListPdf.test.tsx`), `npm run
typecheck:tests`, `npm run build` (production
build succeeds; no chunk exceeds Vite's 500 kB
warning in the eagerly-loaded path — see "Bundle size" below), `npm run test:supabase:sql` (real, against a
native Postgres, all 8 assertions pass — confirms no SQL regression, though Milestone 3 did not touch
`supabase/`), and `npm run check:secrets` (real — no secrets found in repo or `dist/`).

`npx playwright test --list` shows 13 E2E tests across 9 files. GitHub Actions run `29426947786` executed
all 12 against a real local Supabase stack with zero skips: 7 passed and 5 failed. The 22 integration tests
all passed. The corrective branch keeps desktop and mobile separate but makes both Chromium projects; a
new always-on mobile-modal regression is the thirteenth collected test. A fully green run, rather than
collection/typechecking alone, is required for acceptance.

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
2. No eagerly loaded chunk exceeds Vite's 500 kB warning threshold. The current main chunk is ~247.10 kB
   (~77.84 kB gzip); the on-demand PDF chunk is ~424.26 kB (~139.19 kB gzip).

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

- Milestones 0, 1, 2, and 2.1 are implemented. Milestone 3 code is in corrective verification: its
  Supabase-backed integration/E2E suites have run for real, but the first E2E run was not green.
- `npx playwright test --list` shows 13 tests across 9 files (including the always-on mobile-modal
  regression). All Supabase tests executed in CI run
  `29426947786`; the three mobile tests did not reach their assertions because the old project selected an
  uninstalled WebKit executable. The correction selects Chromium explicitly and awaits a green CI proof.
- `supabase/VERIFY.sql` is now also wrapped in a self-checking, CI-runnable form
  (`supabase/scripts/assertions.sql` via `npm run test:supabase:sql`), executed for real in this
  environment. It is not yet wired into the default CI job (only the new `supabase-integration` job's
  `supabase start` bootstrap exercises the migrations for real; the native-Postgres script stays a local/CI
  fallback command, not a required gate, since it needs `psql` or a `DATABASE_URL`).
- CI runs lint, unit/component tests, typecheck of tests, build, and a secret scan on every push/PR
  (`build` job); the first real `supabase-integration` run passed 22/22 integration tests but failed E2E
  with 7 passed / 5 failed / 0 skipped. A fully green corrective run remains the acceptance gate.

## Known design/implementation risks

### Open editor is not secure

Anonymous policies intentionally allow all data mutations. Public read-only mode is only a UI boundary.

### Workspace conflict policy

Resolved in Milestone 2.1. Shows keep explicit conflict resolution (local/online choice). Workspace
(Library/Presets/Preferences) conflicts implement D-214 (`docs/25-DECISION_LOG.md`): on a confirmed
conflict, discard the conflicting local Workspace mutation, apply the latest remote Workspace, and notify
the user via toast — no comparison dialog, no duplicate copy. See `src/lib/workspaceSync.ts` and
`docs/14-SYNC_OFFLINE_AND_LOCKS.md` "Workspace conflicts". Milestone 3 did not change this behavior.

### Delete Undo and remote identity

The editor offers local Show Undo. Remote deletion and public slug restoration semantics need an E2E test to ensure Undo does not create a misleading or inconsistent public link state.

### Service Worker update lifecycle — resolved in Milestone 3

`public/sw.js` no longer calls `self.skipWaiting()` unconditionally on install; a new worker sits in
`waiting` until the app explicitly tells it to take over. `src/lib/useServiceWorkerUpdate.ts` detects a
genuine new version (a worker finishing install while a previous version already controls the page — not
the very first install), and `src/components/UpdateNotice.tsx` shows a persistent, dismissal-free notice
with an "Actualizar ahora" action. Applying it posts `SKIP_WAITING`, waits for `controllerchange`, and does
a single controlled reload; a stuck update (no `controllerchange` within 8s) surfaces "Reintentar" instead
of leaving the UI stuck. The cache is explicitly versioned (`orion-shows-v2.0.0-m3.1`), so an installing
worker never mutates the active worker's cache; activation removes only older `orion-shows-*` caches. The
hourly polling interval and every listener are removed on unmount/remount. Verified with a real browser
round-trip (build → serve → bump `sw.js` on disk → confirm notice appears → click update → confirm reload
lands on the new version, notice clears) plus 13 automated tests across
`tests/unit/useServiceWorkerUpdate.test.ts`, `tests/unit/serviceWorker.test.ts`, and
`tests/component/UpdateNotice.test.tsx`.

### Bundle size — improved in Milestone 3

`ShowPage`, `LibraryPage`, `PresetsPage`, `SettingsPage`, and `PublicShowPage` are now `React.lazy` routes
(the Shows list stays eager since it's the common landing page), and `vite.config.ts` splits
`@supabase/supabase-js` and `dexie` into their own vendor chunks. The main chunk dropped from ~646 kB to
~247 kB (gzip ~184 kB → ~78 kB), clearing Vite's 500 kB warning entirely for the eagerly-loaded path. The
PDF module (`src/lib/inputListPdf.ts`, `jspdf` + `jspdf-autotable`) was already behind a dynamic `import()`
and remains a separate, on-demand-only chunk (~424 kB) — it is not part of the initial load. The Input List
PDF export button now shows a loading state while the module loads and the document is generated, and shows
a toast instead of failing silently if generation throws. See `docs/19-TESTING_STRATEGY.md` for the exact
before/after numbers.

### Validation

The domain relies primarily on TypeScript and normalization functions. Imported JSON and remote JSON should use runtime schema validation.

### Backup retention

Automatic backup creation exists, but retention/capping must be verified to avoid unbounded IndexedDB growth.

### Output collisions

Stereo monitor output labels are calculated, but explicit collision validation should be added and tested.

### Form label association — resolved in Milestone 3

`components/ui.tsx` now exports a `Field` component (`useId()` + `cloneElement`, so `.map()`-rendered
repeated rows never collide on a single hand-wired `id`) used across every genuinely 1:1 field/label pairing
in the app. `Label` remains for the handful of legitimate non-1:1 headings (radio-group and `MultiSelect`
group headings). `tests/e2e/setup.spec.ts` and `tests/e2e/workspace-conflict.supabase.spec.ts` no longer
need placeholder/CSS-`:has()` fallback locators for this reason and now use `getByLabel`.

### Modal accessibility, keyboard reorder, mobile tables, and error recovery — added in Milestone 3

See the "Milestone 3" section below for the accessible `Modal` (dialog role, focus trap, focus
restoration, `Escape`-to-close only when cancelable, background `inert`), the Equipment keyboard
up/down/move-to-category controls (drag & drop kept, not removed), the mobile-viewport verification of
Equipment and Input List, and the route/module-level Error Boundaries.

## Recommended next action

Milestones 0, 1, 2, and 2.1 from `CODEX_START_HERE.md` are implemented. Milestone 3 is implemented but not
accepted until its corrective CI run is wholly green. Before Milestone 4 (release candidate):

1. Obtain a corrective GitHub Actions run where integration and all desktop/mobile Playwright tests execute
   against the local Supabase stack with zero failures, zero skips, and no retry-dependent passes.
2. Decide on the two open items already flagged: monitor-return output collision handling, and
   permanent-delete-versus-Undo semantics after remote sync (`docs/25-DECISION_LOG.md`). Neither is in scope
   for Milestone 3 and neither was touched by it.
3. Keep the remaining non-blocking `docs/22-BACKLOG.md` technical-debt items outside this corrective scope.

Do not add new product features before Milestone 3's acceptance is confirmed against a real Supabase
backend in CI.
