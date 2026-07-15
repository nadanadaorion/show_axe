# Changelog

All notable changes are documented here. Dates refer to candidate preparation until a release is explicitly published.

## [2.0.0] - 2026-07-15 (release candidate)

### Added

- Shared anonymous Supabase workspace with optimistic revisions, Realtime, offline queue, locks, public read-only links and explicit Show conflicts.
- Input List generation/synchronization, manual rows, custom CH, returns and portrait/landscape PDF.
- Accessible modals, keyboard ordering, mobile layouts, Error Boundaries and controlled SW update notice.
- Reproducible unit/component, real Supabase integration, desktop/mobile E2E and GitHub Pages subpath gates.
- Manual GitHub Pages deployment workflow using public runtime variables.
- Automated accessibility checks on critical Setup, desktop and mobile flows.

### Changed

- `package.json` is now the single release-version source for app UI, SW URL and cache name.
- Backup import validates nested data and creates a local emergency snapshot before merge or replace.
- Local backups are capped at the ten newest records.
- PDF export sorts copies and no longer risks mutating Input List arrays.
- Light-theme secondary text contrast increased to pass the automated AA threshold.

### Security

- Source and build secret scanning remain release gates.
- Deployment accepts only Project URL and publishable/anon key; secret/service-role keys are rejected.
- Documentation now states plainly that the main editor is anonymously writable by design.

### Known limitations

- First visit requires network; never-requested lazy chunks are not precached.
- Output collisions between monitor returns are not detected.
- Undo after a deletion already synchronized remotely has unresolved exact semantics.
- No accounts, per-user permissions or private editor data.

No tag or GitHub Release exists for this entry until final approval.
