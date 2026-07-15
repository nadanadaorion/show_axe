# Testing strategy

## Current state

### Milestone 3 corrective pass (PR #4)

The first real GitHub Actions run for Milestone 3 (`29426947786`) was not green: the build job passed,
the real Supabase integration suite passed 22/22 with zero skips, and Playwright finished 7 passed / 5
failed / 0 skipped. All five failures exhausted two configured retries. The failures were: offline status
being overwritten by a Realtime channel error, real-Chromium modal focus restoration, and three mobile
tests configured for WebKit while CI installed only Chromium.

The corrective pass changes mobile to an explicit Chromium 375×667/touch project, defers modal focus
restoration until after portal teardown, keeps offline status authoritative while `navigator.onLine` is
false, versions Service Worker caches, fixes polling/listener cleanup, and retains Playwright traces,
screenshots, videos, reports, and test results on CI failure. Local verification currently passes 115/115
unit/component tests, lint, test typecheck, and production build; final Milestone 3 acceptance remains
pending a completely green GitHub Actions run with zero skips and no retry-dependent passes.
The corrective Playwright configuration sets `retries: 0`, making that requirement explicit rather than
inferring it from a retried result.

Corrective run `29441798211` proved the build and all 22 integration tests green, and uploaded the
configured Playwright failure artifact, but E2E remained at 7 passed / 5 failed with zero retries. The
mobile browser now starts correctly. Two annotated failures exposed a real modal-layout regression: the
sticky action footer overlaid the scrollable form and intercepted the `Crear y abrir` click. The dialog is
now a bounded flex column with an independently scrollable body and non-overlapping header/footer. The
always-on `modal-layout.mobile.spec.ts` reproduces the 375×667 click path without needing Supabase.

Runs `29442680064` and `29443257734` confirmed that the same mobile specs pass locally but are disrupted
when all stateful E2E files run fully parallel against one shared Supabase Workspace and Realtime stream;
the latter run also made the previously green singleton-Workspace scenario fail. Playwright therefore
uses one worker whenever `SUPABASE_TEST_URL` is configured. Desktop and mobile remain distinct Chromium
projects, retries remain zero, and the backend-backed cases no longer mutate shared state concurrently.

The browser follow-up also found two test-design/product details hidden behind the original failures.
Touch Chromium may activate a modal trigger without focusing it, so `Modal` remembers the last pointer
control while closed and restores that exact control after teardown; the component suite includes this
case. Equipment's `size="icon"` utility was overriding the intended 44×44 mobile classes, so the two
reorder controls now use explicit important size overrides (44×44 mobile, 32×32 from `sm` upward).
Finally, the offline queue scenario observes the already-mounted sidebar badge instead of performing an
unrelated offline document navigation to an unvisited lazy chunk, and verifies the flushed Show value
directly in Supabase after reconnection.

Run `29444552586` then passed 10/13 Playwright cases: all desktop, offline, Workspace, setup, public, and
lock flows were green; only the three mobile cases remained. Their pre-click hit-test proved the action
was unobstructed, while Playwright's locator auto-scroll moved the mobile layout immediately before its
mouse-style click. Mobile submits now use a real `touchscreen.tap` at the verified unobstructed center;
there is no forced click or DOM invocation, and obstruction still fails before the tap.

Run `29444981721` reached 12/13. The retained screenshot and error context showed the final failure at the
initial Shows-list overflow assertion: long names from earlier serial cases forced CSS-grid cards 108 px
beyond the 375 px viewport. Show cards now opt into shrinking with `min-w-0 w-full`, allowing the existing
heading truncation to work. The always-on mobile regression seeds six long names and asserts zero page
overflow before opening its modal.

Milestone 0 (test foundation) is implemented:

- Vitest + jsdom run unit and component tests (`npm run test`).
- React Testing Library and `@testing-library/user-event` are available for component tests.
- Playwright is configured for end-to-end tests (`npm run test:e2e`), currently covering only the
  deterministic Setup-screen smoke path (no Supabase project is configured in this environment).
- Deterministic fixture builders live in `tests/fixtures/builders.ts` (Show, Equipment, Input List,
  Workspace, Preset, and both conflict shapes), using a sequential id/timestamp generator instead of
  `crypto.randomUUID()`/`Date.now()` so test output is reproducible.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run lint`, `npm run test`, and `npm run build` on
  every push and pull request.

Milestone 1 (business-rule coverage) is implemented:

- `tests/unit/store.test.ts` exercises the Zustand store (`src/store.ts`) directly, with `src/lib/db.ts`
  and `src/lib/syncQueue.ts` mocked via `vi.mock`. This isolates store business-rule logic (state
  transitions) from Dexie/IndexedDB and the sync queue, per the "pure domain logic" unit-test layer below,
  while still exercising the real reducer code the UI calls — not a reimplementation of it. Because
  `queueShowUpsert`/`queueShowDelete`/`queueWorkspaceUpsert` are invoked synchronously inside the store's
  `commit()` step, mocking them is enough to assert queuing behavior without waiting on any async I/O.
- Covered: Library/Preset edits never mutate already-created Shows; equipment quantity changes keep
  assignments consistent (earliest-preserved on shrink, blank-appended on grow) through the real
  `updateEquipment` action; Show duplication remaps every internal id (categories, equipment, assignments,
  people, schedule, Input List row/return ids) and remaps Input List provenance to the new equipment/
  assignment ids while leaving manual rows untouched; archive preserves the public slug; delete removes the
  Show locally and queues a `show-delete` mutation (not a fresh upsert); JSON import merge/replace
  behavior, including deterministic collision handling (incoming wins on id collision in merge mode);
  `applyPreset` onto an existing Show in both merge mode (adds without removing existing content, reuses a
  category matched by case-insensitive name, resets `checked`, skips a duplicate person by name, leaves
  showType/note/Input List untouched) and replace mode (fully overwrites Equipment/People/Schedule/
  Categories while preserving Show identity and the existing Input List, lets the Preset's showType/note
  win), verified to share no object references with the source Preset in either mode, and verified against
  an empty Preset (merge is a no-op, replace wipes Equipment/People/Schedule/Categories).
- `tests/unit/inputList.test.ts` gained a regression test for D-114 ("reordering or synchronization must
  not overwrite custom CH"): a retained row's manually set channel survives `previewInputListSync`.
- Not covered by Milestone 1 (deliberately, since it would require adding unimplemented product behavior
  rather than testing existing behavior): monitor-return output collision validation. This remains an open
  decision in `docs/25-DECISION_LOG.md` and a documented risk in
  `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md`.
- "Delete removes the public record" is verified only at the local-queue boundary (the Show disappears
  locally and a `show-delete` mutation is queued). Confirming the remote Supabase row is actually deleted
  requires a live/local Supabase instance and belongs to Milestone 2 below.

Milestone 2 (shared-data hardening) is implemented:

- **Fix**: `orion_shows` now uses `replica identity full`
  (`supabase/migrations/202607150002_realtime_replica_identity.sql`). The public Show route filters
  Realtime `DELETE` events by `public_slug`, a non-primary-key column; without full replica identity,
  Postgres omits non-key old-row data from `DELETE` events, so a live public page would not learn about a
  deletion until reload. This was found by code review, not by a failing test (no live Supabase was
  reachable to observe it directly) — see "What could not be executed in this environment" below.
- **SQL-level verification, executed for real**: `supabase/scripts/verify-sql-native.sh` (`npm run
  test:supabase:sql`) applies every migration to a throwaway native-Postgres database twice from empty
  (proving idempotency) and runs `supabase/scripts/assertions.sql`, a self-checking script (raises an
  exception on any mismatch) covering optimistic concurrency, lock acquire/block/heartbeat-renew/release,
  lock expiry after the ten-minute inactivity ceiling, delete (and its idempotency), open `anon` RLS, the
  `public_slug` uniqueness constraint, and the replica-identity fix. This is a fallback for environments
  without Docker (see "Native-Postgres fallback" below) — it approximates only the `anon`/`authenticated`
  roles and an empty `supabase_realtime` publication that the real platform provides, and does not exercise
  PostgREST or actual Realtime delivery.
- **Real Supabase integration tests** (`tests/integration/`, `npm run test:integration`), using
  `@supabase/supabase-js` against the actual RPC/table contract — never mocked:
  - `shows.test.ts`: create, read from a second client, update, archive/restore, delete, and revision-conflict detection plus both resolution paths (keep local / keep online);
  - `locks.test.ts`: acquire, heartbeat renew, release, ten-minute inactivity expiry, and a second client rejected while the lock is held;
  - `workspace.test.ts`: Library/Presets/Preferences as one Workspace document, and the existing (untouched) local-last Workspace conflict policy, now superseded by the approved remote-wins policy — see "Workspace conflict policy: decided, implementation pending" below;
  - `realtime.test.ts`: an INSERT is delivered to a second subscribed client;
  - `public.test.ts`: public lookup by slug while active/archived, gone after delete.
  All five skip themselves (`describe.skipIf`) with a clear console message when `SUPABASE_TEST_URL`/
  `SUPABASE_TEST_ANON_KEY` are unset or unreachable — never a mock standing in for a real response.
- **Real Supabase E2E tests** (`tests/e2e/*.supabase.spec.ts`, `npm run test:e2e`), gated the same way via
  `test.skip(!config, …)`: `public-route.supabase.spec.ts` (public link survives archive, stops resolving
  after delete, no mutation controls visible), `lock-block.supabase.spec.ts` (a second device is blocked
  and can acquire after the first releases), `offline-conflict.supabase.spec.ts` (offline edits queue and
  flush on reconnect; a stale offline edit conflicts with a concurrent remote change, tested through both
  "keep local" and "keep online").
- **Unit/component coverage that does not need a live backend**: `tests/unit/supabase.test.ts`
  (`remoteRowToShow` mapping, pure), `tests/unit/syncQueue.test.ts` (offline queue coalescing against a
  real in-memory IndexedDB via `fake-indexeddb` — not a mock of the queue's own logic), and
  `tests/component/useShowLock.test.tsx` (the lock hook's local state machine — acquire/blocked/heartbeat/
  release/expiry/offline — with only `src/lib/supabase.ts` mocked, never a claim that this proves Supabase
  itself works).
- **Secret scanning, executed for real**: `scripts/check-no-secrets.sh` (`npm run check:secrets`) greps the
  repo source and a production `dist/` build for service-role/secret-key patterns and JWT-shaped literals.
- **CI**: `.github/workflows/ci.yml` gained a `supabase-integration` job that runs `supabase start` (via
  `supabase/setup-cli`) on GitHub-hosted runners — which, unlike some sandboxed dev environments, can pull
  the Supabase CLI's Docker images — then runs the real integration and `.supabase.spec.ts` E2E suites
  against it. The default `build` job also gained `npm run typecheck:tests` and `npm run check:secrets`.

#### What could not be executed in this environment

This sandbox's Docker daemon cannot pull images from Docker Hub (an explicit `403`/policy denial from the
network proxy — confirmed, not assumed), so `supabase start` cannot run here, and no real hosted Supabase
project was available either. As a direct consequence, `tests/integration/`, `tests/e2e/*.supabase.spec.ts`,
and the `supabase-integration` CI job were written and verified for syntax/types
(`npm run typecheck:tests`, `npx playwright test --list`) and confirmed to skip cleanly (exit 0) rather than
hang or fake-pass, but their actual assertions have **not** been executed against a real backend by this
change. They later ran for real in GitHub Actions; see "Milestone 3 corrective pass" above for the first
run's exact results and the remaining green-run gate.
The SQL-level checks (native-Postgres fallback) **were** executed for real, repeatedly, in this environment.

#### Native-Postgres fallback (used in this environment)

`supabase/scripts/verify-sql-native.sh` is a lightweight fallback for exactly this situation: no
Docker-based local Supabase stack available. It uses whatever `psql`/Postgres is present (or a
`DATABASE_URL`, e.g. the official `postgres:16` GitHub Actions service container) instead of the full
platform. It proves the migrations and RPC/RLS logic are correct; it does **not** prove PostgREST request
shapes or real Realtime delivery — that requires `supabase start` or a real project, which is exactly what
the gated integration/E2E suites above are for.

#### Workspace conflict policy: decided and implemented (Milestone 2.1)

At the time the Milestone 2 suite above was written, `docs/25-DECISION_LOG.md` listed the Workspace
concurrent-edit policy as an open decision, so `tests/integration/workspace.test.ts` tested and documented
the *existing* local-last retry behavior as it stood then. D-214 has since closed the decision as
**remote-wins** (see `docs/14-SYNC_OFFLINE_AND_LOCKS.md` "Workspace conflicts") and Milestone 2.1
implemented it in `src/lib/workspaceSync.ts` (`processWorkspaceMutation`), merged to `main` before
Milestone 3 started. The real two-client proof is `tests/e2e/workspace-conflict.supabase.spec.ts`
(discards the local edit, applies the latest remote Workspace, shows the "Se conservaron los cambios en
línea…" notice, no picker). Milestone 3 did not modify this policy or its tests, beyond updating that
spec's Settings-page selectors from CSS `:has()` fallbacks to `getByLabel` now that Milestone 3 gave those
fields proper label association (see "Milestone 3" below).

## Test layers

### Unit tests

Use Vitest for pure domain logic:

- ID remapping during Show/Preset duplication;
- assignment normalization;
- Input List generation;
- synchronization preview;
- channel renumbering and next-channel calculation;
- return output labels and allocation;
- schedule duration;
- snapshot normalization/import validation;
- sync queue coalescing.

### Component tests

Use React Testing Library for:

- Create Show modal;
- equipment expansion and assignments;
- incomplete Input List warning preference;
- Input List editing and preview;
- conflict modal choices;
- blocked lock state;
- public route read-only controls;
- Error Boundary recovery, including `RouteErrorBoundary`/`GlobalErrorBoundary` navigation and the backup
  export failure path (`tests/component/ErrorBoundary.test.tsx`, Milestone 3);
- `Modal` accessibility — dialog role/name, focus trap, focus restoration, conditional `Escape`, background
  `inert` — and `Field` label association, including next-frame restoration to the exact trigger after
  Escape and action-button closure (`tests/component/Modal.test.tsx`, Milestone 3);
- Equipment keyboard reordering and move-to-category, against the real store
  (`tests/component/EquipmentReorder.test.tsx`, Milestone 3);
- the Service Worker update hook's state machine — first-install vs. genuine update, apply/reload,
  stuck-update retry, one polling interval per mount, and full cleanup/remount — with a hand-built fake
  `navigator.serviceWorker` (no real browser SW timing)
  (`tests/unit/useServiceWorkerUpdate.test.ts`, Milestone 3), and the notice UI it drives
  (`tests/component/UpdateNotice.test.tsx`, Milestone 3);
- the Service Worker script's versioned-cache isolation, cleanup of only older Ori♡n caches, preservation
  of current/unrelated caches, explicit `SKIP_WAITING`, and absence of auto-activation
  (`tests/unit/serviceWorker.test.ts`, Milestone 3 correction);
- Input List PDF export's on-demand loading state and generation-error handling, with
  `src/lib/inputListPdf.ts` mocked (`tests/component/InputListPdf.test.tsx`, Milestone 3).

### Integration tests

Implemented in `tests/integration/` (`npm run test:integration`), against a disposable Supabase project or
local Supabase stack — see "Milestone 2" above for exactly what each file covers:

- bootstrap SQL (`supabase/scripts/verify-sql-native.sh`, executed against native Postgres);
- optimistic create/update/delete (`shows.test.ts`);
- revision conflict payload and both resolution paths (`shows.test.ts`);
- lock acquire/renew/block/release/expiry (`locks.test.ts`);
- Realtime Show insert delivery (`realtime.test.ts`);
- anonymous RLS access exactly as documented (`supabase/scripts/assertions.sql`, and implicitly by every
  integration test succeeding with only an anon key).

#### Disposable Supabase workflow

1. Run the Supabase CLI local stack (`supabase start`, requires Docker) against `supabase/config.toml`, or
   create a short-lived free-tier Supabase project dedicated to CI/test runs — never point integration
   tests at the production project.
2. `supabase start` applies every migration under `supabase/migrations/` automatically from empty; for a
   manually created project, run `supabase/SETUP.sql` in the SQL Editor instead.
3. Run `supabase/VERIFY.sql` (or `npm run test:supabase:sql` for a self-checking pass) to confirm tables,
   policies, RPC signatures, the Realtime publication, and replica identity match
   `docs/15-SUPABASE_AND_DATABASE.md` exactly.
4. Copy `.env.example` to `.env`, fill in `SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY` (`supabase status`
   prints the local values), and export them.
5. Run `npm run test:integration` and `npm run test:e2e` (the `.supabase.spec.ts` files pick up the same
   env vars), then discard the instance (`supabase stop` or delete the throwaway project) so no test data
   persists between runs.
6. In CI, this runs as the separate `supabase-integration` job in `.github/workflows/ci.yml`.

### End-to-end tests

Implemented in `tests/e2e/`. `setup.spec.ts` needs no Supabase config (tests the unconfigured state); the
`*.supabase.spec.ts` files need `SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY` and self-skip otherwise:

1. create Show on device A and observe on B — `tests/integration/realtime.test.ts` (no browser needed for
   Realtime delivery itself);
2. lock Show on A and block B, then release and acquire on B — `lock-block.supabase.spec.ts`;
3. expire a lock and acquire on B — `tests/integration/locks.test.ts` (RPC-level; a real 10-minute wait in
   a browser is impractical, so this is proven against the RPC directly, exactly like the product's own
   lock UI does under the hood);
4. edit offline on A, edit online on B (simulated via a second `@supabase/supabase-js` client, since a
   truly concurrent third device only matters for the revision it leaves behind), reconnect A, resolve the
   conflict both ways — `offline-conflict.supabase.spec.ts`;
5. create public link and verify read-only route; 6. archive and verify public link remains; 7. delete and
   verify public route becomes not found — all three in `public-route.supabase.spec.ts`;
8. generate an Input List and open PDF export — covered by `smoke-desktop.supabase.spec.ts` (the loading
   state and error-handling around it are covered separately at the component level, see above);
9. reload offline after first successful visit — covered already by the existing Service Worker baseline;
   the update-available flow added in Milestone 3 was additionally verified once with a real
   build/serve/version-bump browser round-trip (not part of the committed automated suite — see
   `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md` "Service Worker update lifecycle").

**Milestone 3** added two more real-Supabase E2E files plus a second Playwright project for a mobile
viewport:

- `smoke-desktop.supabase.spec.ts` (`chromium` project): Shows listing, opening a Show, adding Equipment,
  the Input List, a modal (dialog role/name, `Escape`-close, focus return to the trigger), and keyboard-only
  Equipment reordering, in one flow.
- `equipment-inputlist.mobile.spec.ts` and `smoke-mobile.mobile.spec.ts` (`mobile` project,
  explicit Chromium at 375×667 with touch/mobile emulation, matched via `playwright.config.ts`'s
  `testMatch: '**/*.mobile.spec.ts'`): the same
  breadth on a 375×667 viewport, plus explicit page-level horizontal-overflow assertions
  (`document.documentElement.scrollWidth - clientWidth === 0`) and a custom-channel-number edit.

- `modal-layout.mobile.spec.ts` (`mobile` project, always on): proves that the create-Show form does not
  overlap the action footer and that the real pointer click closes the modal, using an unreachable local
  runtime so the local-first UI can be exercised without a Supabase dependency.

No visual/snapshot tests were added — every assertion is role/name/focus/state/navigation-based, per the
Milestone 3 authorization ("no golden snapshots this milestone").

CI retains trace, screenshot, and video for every failed Playwright test and uploads
`playwright-report/` plus `test-results/` as the `playwright-failure-artifacts` artifact when the E2E step
fails. The Supabase job runs the complete collected Playwright suite (including the always-on mobile
modal regression), not a title-filtered subset. Generated artifacts remain gitignored.

## Fixtures

`tests/fixtures/builders.ts` provides builders for:

- empty Show (`buildEmptyShow`);
- Show with grouped microphones and assignments (`buildShowWithMicrophones`);
- Input List with custom channels beginning at 17 (`buildInputListStartingAt17`);
- mixed manual/generated rows (`buildMixedInputList`);
- mono/stereo monitor returns (`buildMonitorReturn`);
- remote revision conflict (`buildRevisionConflict`);
- deleted-remote conflict (`buildDeletedRemoteConflict`);
- Workspace with Library and Presets (`buildWorkspace`).

Call `resetFixtureSequence()` in a `beforeEach` when a test depends on exact generated ids.

## Quality gates

Minimum release gates:

- `npm run lint` passes;
- TypeScript build passes (`npm run build`), and test files typecheck too (`npm run typecheck:tests`);
- unit/component tests pass (`npm run test`);
- critical E2E suite passes (`npm run test:e2e`, both the always-on and, when Supabase is configured, the
  `.supabase.spec.ts` files) across both explicit Chromium Playwright projects: desktop and mobile
  (375×667, touch/mobile emulation);
- SQL verification passes (`npm run test:supabase:sql`, and/or `supabase/VERIFY.sql` against a real
  instance);
- Supabase integration suite passes when a backend is configured (`npm run test:integration`);
- no secrets detected (`npm run check:secrets`);
- production bundle has no chunk over Vite's 500 kB warning threshold in the eagerly-loaded path (the
  on-demand PDF chunk is exempt — see `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md` "Bundle size").

## Regression rules

Every fixed bug receives a regression test. A black-screen runtime failure requires an Error Boundary test and a direct test of the triggering selector/render condition.
