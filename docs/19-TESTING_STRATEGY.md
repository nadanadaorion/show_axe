# Testing strategy

## Current state

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
  behavior, including deterministic collision handling (incoming wins on id collision in merge mode).
- `tests/unit/inputList.test.ts` gained a regression test for D-114 ("reordering or synchronization must
  not overwrite custom CH"): a retained row's manually set channel survives `previewInputListSync`.
- Not covered by Milestone 1 (deliberately, since it would require adding unimplemented product behavior
  rather than testing existing behavior): monitor-return output collision validation. This remains an open
  decision in `docs/25-DECISION_LOG.md` and a documented risk in
  `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md`.
- "Delete removes the public record" is verified only at the local-queue boundary (the Show disappears
  locally and a `show-delete` mutation is queued). Confirming the remote Supabase row is actually deleted
  requires a live/local Supabase instance and belongs to Milestone 2 below.

Milestone 2 (live Supabase integration/E2E) is not yet implemented; see below for the disposable-project
workflow it will use.

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
- Error Boundary recovery.

### Integration tests

Against a disposable Supabase project or local Supabase stack:

- bootstrap SQL;
- optimistic create/update/delete;
- revision conflict payload;
- lock acquire/renew/block/release/expiry;
- Realtime Show insert/update/delete;
- anonymous RLS access exactly as documented.

#### Disposable Supabase workflow

This environment has no live Supabase project and cannot provision one. The documented workflow for
Milestone 2 is:

1. Run the Supabase CLI local stack (`supabase start`) against a throwaway Docker Postgres instance, or
   create a short-lived free-tier Supabase project dedicated to CI/test runs — never point integration
   tests at the production project.
2. Apply `supabase/SETUP.sql` (or the migrations under `supabase/migrations/`) to that instance so schema,
   RPCs, RLS policies, and the Realtime publication match `docs/15-SUPABASE_AND_DATABASE.md` exactly.
3. Run `supabase/VERIFY.sql` against the instance to confirm tables, policies, RPC signatures, and the
   Realtime publication exist before running tests.
4. Point `public/config.js` (or the local runtime-config override) at the disposable project's URL and
   publishable key for the duration of the run only.
5. Run the integration/E2E suites described above, then discard the instance (`supabase stop` or delete
   the throwaway project) so no test data persists between runs.
6. In CI, this stage runs as a separate, optional job gated on secrets for a dedicated test project (or a
   `supabase start` service container); it must never share credentials with the production deployment and
   must not run on forks/untrusted pull requests.

Until this job exists, integration/E2E behavior against Supabase remains manually verified only, as noted
in `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md`.

### End-to-end tests

Use Playwright with two browser contexts to simulate devices:

1. create Show on device A and observe on B;
2. lock Show on A and block B;
3. expire/release lock and acquire on B;
4. edit offline on A, edit online on B, reconnect A, resolve conflict both ways;
5. create public link and verify read-only route;
6. archive and verify public link remains;
7. delete and verify public route becomes not found;
8. generate Input List and PDF action;
9. reload offline after first successful visit.

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

- lint passes;
- TypeScript build passes;
- unit/component tests pass;
- critical E2E suite passes;
- SQL verification passes;
- no secrets detected;
- manual mobile smoke test completed.

## Regression rules

Every fixed bug receives a regression test. A black-screen runtime failure requires an Error Boundary test and a direct test of the triggering selector/render condition.
