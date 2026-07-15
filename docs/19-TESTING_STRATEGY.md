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

Milestone 1 (business-rule coverage) and Milestone 2 (live Supabase integration/E2E) are not yet
implemented; see below for the disposable-project workflow they will use.

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
