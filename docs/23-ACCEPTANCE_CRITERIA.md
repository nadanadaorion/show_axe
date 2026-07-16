# Acceptance criteria

Status for the `2.0.0` candidate. `[x]` requires automated or recorded manual evidence; `[ ]` is deliberately not accepted. Final CI evidence must refer to the candidate SHA, not an earlier milestone.

## Application shell and release operations

- [x] Production build loads under `/show_axe/` with shell, assets and lazy chunks (`tests/pages/github-pages.spec.ts`).
- [x] Missing runtime config shows a usable Setup screen (`tests/e2e/setup.spec.ts`, Pages test).
- [x] Global/route/lazy errors show recovery instead of a black screen (`tests/component/ErrorBoundary.test.tsx`).
- [x] Subsequent offline reopen works after an online controlled load (Pages test).
- [x] Controlled SW update, timeout, cleanup and reload guards are tested (SW/update unit/component suites).
- [x] App/cache/docs use version `2.0.0` from one maintained source.
- [x] Manual Pages workflow validates public runtime values and scans the artifact.
- [ ] Production Pages deployment smoke on the final merged SHA (requires approval and deployment).
- [ ] Annotated `v2.0.0` tag and GitHub Release (prohibited until final approval).

## Core product

- [x] Show create/open, blank/preset paths, duplicate ID/slug remapping, search/archive and snapshot isolation are covered by store/component/E2E tests.
- [x] Equipment add/free/library, categories, quantity/assignments, inclusion, progress and keyboard ordering are covered by domain/component/E2E tests.
- [x] People data, ordering and Library snapshot isolation are covered by store/domain tests.
- [x] Information/schedule persistence, chronology and duration are covered by store and utility tests.
- [x] Library and Preset CRUD/apply/merge behavior is covered by store and E2E regression suites.
- [ ] Undo after a delete that already synchronized remotely is fully specified and deterministic. Immediate queued Undo is tested; the remote-completed edge remains an approved open decision.

## Input List and PDF

- [x] Generation from included Equipment assignments and explicit sync preview are tested.
- [x] Manual rows/edits, custom CH, arbitrary start, explicit renumber, reorder preservation and next numeric CH are tested.
- [x] Phantom, patch and notes survive domain sync and reach PDF mapping.
- [x] Mono/stereo returns and consecutive stereo labels are tested.
- [x] Portrait, landscape, multipage numbering, exact CH and non-mutating export are tested (`tests/unit/inputListPdf.test.ts`).
- [x] PDF code is dynamically imported and isolated from the entry bundle.
- [ ] Return-output collision handling is defined. It remains an explicit open decision and is not implemented.

## Backups and recovery

- [x] JSON snapshot version excludes credentials, locks, revisions and pending mutations by construction.
- [x] Nested invalid/incompatible data is rejected before mutation.
- [x] Merge and replace are deterministic and tested.
- [x] A local emergency backup is created before import.
- [x] Local backup retention is capped at ten newest records.
- [x] Error Boundary offers safe emergency export and handles export failure.
- [x] V1 local database is not automatically migrated; manual versioned JSON import is the only path.

## Shared data, locks and public view

- [x] Initial pull, clean push, Realtime, fallback polling and offline queue/reconnect are covered by real Supabase integration/E2E.
- [x] A delayed Realtime event with an older revision cannot overwrite newer local/synchronized Show data. Remote Show application now compares against the last accepted revision in `syncRecords`: lower revisions and equal echoes perform no Zustand/IndexedDB write, while higher revisions retain the existing pending-mutation guard. A successful save also preserves and rebases any newer coalesced edit. Unit coverage and real-Supabase run `29460043696` (including 20/20 stress repetitions) prove the invariant.
- [x] Revision conflicts expose keep-online/keep-local without silent overwrite.
- [x] Workspace concurrent edits follow documented remote-wins behavior.
- [x] Lock acquire/block/renew/release/expiry/offline behavior is covered without force unlock.
- [x] Permanent public slug, read-only surface, archived visibility, delete/not-found and data minimization are covered.
- [x] RLS is deliberately public and verified; documentation warns that the main editor URL grants write access.
- [x] Migrations from an empty Supabase stack, schema objects, RPC/triggers, RLS, Realtime publication and replica identity are part of CI/verification scripts.

## Accessibility and responsive

- [x] Dialog role/name, form labels, Escape, focus restoration and keyboard reorder are tested.
- [x] Mobile 375×667 flows, no page-level overflow and 44×44 critical reorder targets are tested.
- [x] Axe WCAG A/AA-tag scans run on Setup and configured desktop/mobile critical flows.
- [x] The audit-found light-theme muted contrast defect is corrected and guarded by the Pages axe scan.
- [ ] Full WCAG conformance. No such claim is made without a comprehensive manual/AT audit.

## Final quality gate

- [x] Local lint, typecheck, unit/component build and Pages production test pass on the working candidate.
- [x] Production build emits no sourcemaps and no chunk-size warning; bundle measurements are recorded.
- [ ] Final HEAD GitHub Actions runs: three complete consecutive executions on the final documentation SHA must succeed. Code-candidate run `29460043696` is green, including the real-Supabase gate and 20/20 stress repetitions; final-SHA repetitions remain pending at this documentation commit.
- [ ] Final HEAD counts: zero failed, zero required skips and zero retries for Supabase/desktop/mobile.
- [x] Final HEAD secret scan: source and `dist/` clean in the latest build job.

The two open product-decision boxes do not authorize Milestone 4 to change their semantics. Production deployment, merge and tag remain deliberately unaccepted until the final-SHA repeated gate and explicit owner approval.
