# Testing strategy

## Current state

The included baseline has no automated test suite. Establishing tests is the first implementation milestone.

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

Provide builders for:

- empty Show;
- Show with grouped microphones and assignments;
- Input List with custom channels beginning at 17;
- mixed manual/generated rows;
- mono/stereo monitor returns;
- remote revision conflict;
- deleted-remote conflict;
- Workspace with Library and Presets.

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
