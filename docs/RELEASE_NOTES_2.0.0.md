# Ori♡n Shows 2.0.0 — candidate release notes

## Summary

V2.0.0 turns the local show-preparation app into a tested local-first shared workspace. It combines immediate IndexedDB persistence with an intentionally open Supabase backend, real-time propagation, offline queueing, conflict choices, temporary Show locks and permanent public read-only links.

Milestones 0–3 established automated verification, protected core domain rules, hardened two-device synchronization and improved UX/resilience. Milestone 4 adds reproducible Pages deployment, unified versioning, deeper backup/PDF regression coverage, accessibility automation and operational documentation.

## Operator-visible improvements

- Clear Setup and security warning.
- Desktop/mobile critical flows with accessible modal and keyboard behavior.
- Controlled “Nueva versión disponible” activation rather than silent worker replacement.
- Version shown in Preferencias.
- JSON validation and pre-import emergency backup.
- Maximum of ten local backups.
- Vertical/horizontal multipage PDF regression coverage.
- Static deployment under `https://<user>.github.io/show_axe/`.

## Deployment prerequisites

- Approved and merged release PR.
- Final candidate CI entirely green with zero required skips/retries.
- Supabase schema installed and verified.
- GitHub Actions variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- JSON and database backups retained.

Follow `GUIA_CONFIGURACION_V2.md` and `docs/20-DEPLOYMENT_AND_OPERATIONS.md`. Deployment is manual. Tag `v2.0.0` is proposed but must not be created before explicit approval.

## Known risks

- Anyone with the main URL can mutate or delete workspace data.
- Offline locks cannot be enforced and concurrent edits can conflict.
- First visit and unvisited lazy chunks need network.
- Return-output collisions require manual checking.
- Immediate Undo can replace a pending delete, but Undo after the remote delete has completed is not fully specified and may conflict.
- Automated axe coverage is limited to critical tested surfaces; no complete WCAG conformance claim is made.

## Verification record

Local candidate: lint/typecheck/build passed; 124/124 unit/component passed; Pages production E2E 1/1 passed with no retry; bundle and limitations recorded in `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md`.

The final branch CI run ID and exact Supabase/E2E counts must be inserted after it succeeds. Until then this remains a release candidate.
