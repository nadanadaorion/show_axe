# Roadmap

## Baseline already present

- Core V1 modules.
- V1.1 Input List and PDF.
- V2 candidate synchronization, locks, conflicts, public routes.

## Milestone 0 — verification foundation

- Vitest and React Testing Library.
- Playwright.
- Test fixtures.
- CI.
- SQL verification workflow.
- Document actual Supabase test environment.

Exit: lint, tests, and build run in CI.

## Milestone 1 — core-domain regression protection

- Show snapshot tests.
- Equipment/assignment tests.
- Preset merge/replace tests.
- Input List generation/sync/channel tests.
- import/export validation tests.

Exit: critical local behavior is protected.

## Milestone 2 — shared-data hardening

- Real Supabase integration tests.
- Offline queue and reconnect.
- Show conflict resolution.
- Lock protocol under two devices.
- Remote delete behavior.
- Workspace concurrent-edit policy decision and implementation.

Exit: no silent data loss in tested two-device scenarios.

## Milestone 3 — UX and resilience

- modal accessibility;
- keyboard ordering alternatives;
- mobile technical-table behavior;
- clear Service Worker update flow;
- structured error recovery;
- performance/code splitting for PDF bundle.

Exit: usable on desktop and mobile with resilient failure states.

## Milestone 4 — release candidate

- acceptance checklist complete;
- security warning visible in docs/setup;
- migration scripts verified;
- GitHub Pages deployment tested;
- release notes and rollback package.

Exit: V2.0 production release.

## Post-V2 candidates

Only after separate decisions:

- audit history;
- soft delete/recycle bin;
- protected editor access without personal accounts;
- attachments;
- stage plot;
- export formats beyond PDF/JSON;
- per-device preferences;
- richer patch/output validation.
