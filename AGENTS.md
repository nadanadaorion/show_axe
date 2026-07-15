# AGENTS.md — Ori♡n Shows

This repository contains a real, compilable baseline of Ori♡n Shows plus the product and technical specification that governs further work.

## Read before editing

1. `CODEX_START_HERE.md`
2. `docs/00-SOURCE_OF_TRUTH.md`
3. `docs/01-PRODUCT_VISION.md`
4. `docs/05-BUSINESS_RULES.md`
5. The module document related to the task.
6. `docs/23-ACCEPTANCE_CRITERIA.md`

## Non-negotiable product rules

- The Show is the main entity.
- A Show is a snapshot. Later Library edits must never mutate existing Shows.
- Create first, configure afterward.
- Common actions must require as few steps as possible.
- Prefer Undo over blocking confirmation dialogs.
- Catalogs are helpers, never mandatory.
- V2 has no accounts or authentication.
- Anyone who can access the editor URL can edit all shared information.
- Public Show routes are read-only in the UI.
- Offline editing is allowed.
- Show conflicts offer exactly two outcomes: keep local or keep online.
- A Show lock expires after ten minutes of inactivity and cannot be forcibly overridden.
- Input channel numbers are user-controlled and must not be silently renumbered.

## Technical constraints

- React + Vite + TypeScript.
- Local-first persistence with Dexie/IndexedDB.
- Shared backend with Supabase.
- Runtime Supabase credentials are loaded from `public/config.js`.
- Never commit a Supabase secret key or service-role key.
- GitHub Pages must remain supported; routing must work under a repository subpath.
- Preserve JSON import/export compatibility unless a documented migration is added.
- Database changes require an idempotent SQL migration and an update to `docs/15-SUPABASE_AND_DATABASE.md`.

## Required workflow for every change

1. Identify the governing requirement and acceptance criteria.
2. Inspect current code before changing architecture.
3. Make the smallest coherent change.
4. Add or update automated tests.
5. Run:

```bash
npm ci
npm run lint
npm run test --if-present
npm run build
```

6. Update relevant documentation and the decision log when behavior changes.
7. Report what changed, what was verified, and any unresolved risk.

## Definition of done

A task is not done when code merely exists. It is done when:

- behavior matches the specification;
- error, loading, empty, offline, and conflict states are handled;
- keyboard and mobile behavior are acceptable;
- tests cover critical rules;
- lint and production build pass;
- documentation reflects the implementation;
- no secrets or environment-specific URLs are committed.
