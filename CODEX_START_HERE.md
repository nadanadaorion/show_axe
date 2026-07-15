# Start here — implementation brief for Codex

## Mission

Turn the existing Ori♡n Shows repository into a stable production application without redesigning the product. The current code is a functional baseline, not a blank scaffold. Preserve working behavior and close the verified gaps in controlled increments.

## Product in one paragraph

Ori♡n Shows is a low-friction web application for preparing live shows. A Show centralizes equipment, people, general information, schedules, an editable input list, monitor returns, and reusable presets. V2 adds a shared Supabase workspace with no accounts, local-first offline operation, explicit conflict resolution, temporary editing locks, and permanent read-only public Show links.

## Current baseline

The repository currently:

- compiles with TypeScript and Vite;
- passes ESLint;
- implements Shows, Equipment, People, Information, Library, Presets, Preferences, JSON backups, Input List, PDF export, local IndexedDB storage, Supabase synchronization, offline queueing, Show locks, conflicts, and public routes;
- includes `supabase/SETUP.sql` for the shared backend;
- has no automated test suite and has not been validated end-to-end against a real Supabase project in this environment.

See `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md` for the exact implementation status.

## First implementation sequence

Do not begin by rewriting the UI or replacing the state architecture.

### Milestone 0 — establish trust

1. Add Vitest + React Testing Library.
2. Add Playwright.
3. Add deterministic fixtures/builders for Show, Equipment, Input List, Workspace, and conflicts.
4. Add CI for lint, unit tests, and build.
5. Add a local Supabase integration-test strategy or a documented test project workflow.

### Milestone 1 — protect core product rules

Add tests for:

- Library changes do not mutate existing Shows.
- Equipment quantities and assignments remain consistent.
- Input List generation, synchronization preview, manual edit preservation, editable CH, and stereo return output allocation.
- Duplicate Show remaps internal IDs correctly.
- Archive preserves public slug; delete removes the public record.
- JSON import validation and merge/replace behavior.

### Milestone 2 — verify shared synchronization

Test and harden:

- clean initial pull;
- offline queue then reconnect;
- optimistic revision conflict;
- choose local;
- choose online;
- remote delete versus local edit;
- lock acquisition, heartbeat, expiry, release, and blocked UI;
- Realtime disconnect with periodic-sync fallback;
- workspace concurrent edits.

### Milestone 3 — release hardening

- Accessibility audit.
- Mobile interaction audit.
- Service Worker update/recovery behavior.
- PDF snapshot tests or structured export tests.
- GitHub Pages deployment verification.
- Supabase SQL verification script.
- Release checklist and version bump.

## How to work

Work one milestone or narrowly scoped issue at a time. Before every implementation, cite the relevant document section in your plan. After every implementation, run all quality gates and update `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md`.

## Initial Codex prompt

Use this exact prompt in Codex after opening the repository:

> Read `AGENTS.md`, `CODEX_START_HERE.md`, `docs/00-SOURCE_OF_TRUTH.md`, `docs/05-BUSINESS_RULES.md`, `docs/14-SYNC_OFFLINE_AND_LOCKS.md`, `docs/19-TESTING_STRATEGY.md`, `docs/23-ACCEPTANCE_CRITERIA.md`, and `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md`. Inspect the existing code. Implement Milestone 0 only: add a maintainable automated test foundation and CI without changing product behavior. Run lint, tests, and production build. Update the audit document with exact results and remaining risks. Do not redesign the UI or replace Zustand/Dexie/Supabase.
