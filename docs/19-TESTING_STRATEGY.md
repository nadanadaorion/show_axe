# Testing strategy

This document describes the current reproducible release gate. Historical failed runs are evidence of debugging, not acceptance; only the final candidate SHA can satisfy Milestone 4.

## Required layers

### Unit and component

`npm run test` uses Vitest, jsdom, React Testing Library and fake IndexedDB where appropriate. It covers:

- Show/Library/Preset snapshot rules and CRUD transitions;
- Input List generation, sync preview, custom CH, manual rows, phantom/patch/notes and mono/stereo outputs;
- JSON snapshot validation, merge and replace;
- backup retention and Error Boundary recovery/export failure;
- sync queue coalescing, workspace policy and lock UI state;
- monotonic Show revision application, idempotent echoes and preservation/rebasing of edits coalesced while a save RPC is in flight;
- modal semantics/focus, keyboard reorder and update notice;
- SW cache/update state machine;
- real PDF mapping for portrait/landscape, custom CH, stereo, multipage numbering and non-mutation.

### Supabase integration

`npm run test:integration` talks to a real disposable Supabase API. It verifies show/workspace CRUD and revisions, effective remote delete, conflicts, locks, public links, Realtime and RLS behavior. It is not replaced by mocks.

`SUPABASE_INTEGRATION_REQUIRED=true` makes absent URL/key a collection-time failure. CI always sets it after `supabase start`, so required integration and browser scenarios cannot silently skip.

### Browser E2E

`npm run test:e2e` runs Chromium projects:

- desktop: Setup, Shows/Equipment/Input List, modals/keyboard, locks, public routes, offline/conflicts and workspace conflicts;
- mobile: 375×667 modal layout, Shows/Equipment/Input List, 44×44 reorder targets and no horizontal page overflow.

Desktop and mobile smoke flows finish with `@axe-core/playwright` checks tagged WCAG 2 A/AA and 2.1 A/AA. This catches automatable violations only and is not a full WCAG conformance audit.

The Sonic Grunge redesign adds two visual-contract flows without snapshotting implementation details:

- `sonic-grunge.visual.spec.ts` covers Shows, a Show workspace, Equipment/Input List, Library, a modal, keyboard focus, the offline state, the electric-blue token, the local Anybody face, hard-edged surfaces and page-level overflow on desktop;
- `sonic-grunge.mobile.spec.ts` covers the 375×667 layout, Show creation, Equipment, Input List internal scrolling, no page-level horizontal overflow and 44×44 minimum icon targets.

These checks protect usability and the design-system invariants while existing component, integration and E2E suites continue to own behavior. They do not make pixel-perfect or full manual-accessibility claims.

Retries are `0`. A flaky pass obtained through retry would not satisfy release acceptance.

The stale-Realtime release regression has a dedicated real-Supabase browser test in
`tests/e2e/realtime-revision.supabase.spec.ts`. It subscribes the app before creation, applies
rapid revisions through the real RPC, verifies Equipment and Input List in both the subscribed UI
and the remote row, and waits for delayed events before asserting again. CI repeats this spec 20
times with `--repeat-each=20`; retries remain disabled.

### GitHub Pages and offline shell

`npm run test:pages` uses a separate production build at `/show_axe/` and a real preview server. It verifies:

- setup shell and asset responses under the repository subpath;
- versioned SW script URL and exact `/show_axe/` scope;
- an online controlled reload followed by offline reload;
- direct/reloaded `#/public/:slug` navigation and its lazy chunk;
- no same-origin 4xx;
- automated accessibility of the Setup surface.

The public data call is deterministically intercepted in this test; real public RLS/data behavior remains covered by Supabase integration/E2E.

### SQL and migrations

CI starts Supabase from an empty state, which applies `supabase/migrations/`. Integration then exercises the live API. `supabase/VERIFY.sql` is the administrator-facing verification. `npm run test:supabase:sql` is a native-Postgres fallback and does not by itself prove PostgREST, Realtime or the hosted platform.

### Secrets

`npm run check:secrets` scans source and `dist/` for secret/service-role/JWT-shaped literals and confirms the ordinary build ships empty config placeholders. The Pages workflow generates config only from public Actions variables after the build, then scans again.

## Exact local commands

```bash
npm ci
npm run lint
npm run test
npm run typecheck:tests
npm run build
npm run check:secrets
npm run test:pages
```

With disposable Supabase:

```bash
supabase start
export SUPABASE_TEST_URL=http://127.0.0.1:54321
export SUPABASE_TEST_ANON_KEY='local-publishable-or-anon-key'
export SUPABASE_INTEGRATION_REQUIRED=true
npm run test:integration
npx playwright install chromium
npm run test:e2e
npx playwright test tests/e2e/realtime-revision.supabase.spec.ts --project=chromium --repeat-each=20
supabase stop
```

Windows without Bash can run lint/test/typecheck/build/Pages locally, but the exact Bash secret and SQL-native scripts require Git Bash/WSL or Linux CI. CI is mandatory release evidence.

## Release evidence format

Record for each suite:

- candidate SHA and CI run URL/ID;
- passed, failed, skipped and retries;
- desktop/mobile split;
- migration-from-empty result;
- bundle sizes;
- secret scan result.

Required final state: all jobs success, 0 failed, 0 required skips and 0 retries. Manual review must still cover visual PDF quality, contrast beyond tested surfaces, real target hosting and operational recovery.
