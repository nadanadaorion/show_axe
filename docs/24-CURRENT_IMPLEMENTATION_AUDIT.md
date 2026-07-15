# Current implementation audit

Audit date: 2026-07-15. Candidate branch: `codex/milestone-4-release`. Proposed version: `2.0.0`.

## Baseline received

Milestone 3 was merged to `main` as `139472eef1bd3af0e2906b67639fd0fc654323e4`, containing approved commit `ea2c346bd42b6415bcb2f5d23b14383677238a81`. Main CI run `29453236335` succeeded. The accepted M3 run had 115/115 unit/component, 22/22 real Supabase integration and 13/13 Playwright (9 desktop, 4 mobile), with 0 failed, 0 skipped and 0 retries.

## Milestone 4 implementation

### Version and production build

- `package.json` is the single version source (`2.0.0`).
- Vite injects `__APP_VERSION__`; Settings displays it.
- The SW registration adds `?v=2.0.0`; `sw.js` derives `orion-shows-show_axe-v2.0.0` from version plus scope.
- Production build uses relative base by default and an explicit `/show_axe/` Pages build.
- Sourcemaps are not emitted.
- Local measured bundle: entry 250.85 kB / 78.95 kB gzip; PDF chunk 424.27 kB / 139.20 kB gzip; largest eager vendor 214.64 kB. No Vite 500 kB warning.

### GitHub Pages

- Manual official Pages workflow added.
- Runtime config is generated from public repository variables, with validation against secret-key patterns.
- Production test covers repository subpath, shell/assets, public lazy route/reload, exact SW scope, versioned script and subsequent offline use.
- The SW is scoped to `/show_axe/`; it cannot control sibling projects on the same `github.io` origin.
- Custom domain remains optional and must be separately retested.

### Backups and import

- Snapshot validation now checks nested Shows, Presets, Input List and Library collections before mutation and returns understandable errors.
- Merge and replace behavior remains unchanged and tested.
- A local snapshot is created before either import mode.
- Automatic/manual backups are capped at the ten newest records in one IndexedDB transaction.
- PDF sorting now copies arrays instead of mutating Show data.
- Error Boundary emergency export and failure recovery remain covered.

### PDF and Input List

Real export mapping tests cover portrait/landscape, custom CH, phantom, patch, notes, mono/stereo labels, multipage numbering, filename and non-mutation. Domain tests cover generation from Equipment, manual rows, sync preservation and renumbering. PDF remains a dynamic import and its heavy dependencies stay outside the initial chunk.

### Offline and Service Worker

- Version, scope and cache are aligned.
- Update activation remains user-controlled; the listener reloads only for an initiated update and times out safely.
- Cache cleanup is limited to the normalized installation-scope prefix and never touches IndexedDB, sibling projects or unrelated caches.
- Pages test proves an online controlled reload followed by offline reopen.
- First visit offline and never-requested lazy chunks remain unsupported by design.

### Accessibility and responsive

- Added axe automation on critical configured desktop/mobile smoke paths and the unconfigured Pages Setup path.
- A real light-theme contrast defect was found (`4.34:1`) and corrected by changing `--muted` from `#737373` to `#6b6b6b`.
- First candidate CI run `29455695727` found unlabeled editable Equipment category names in both configured smoke flows; contextual `aria-label` values and a component regression assertion correct the issue.
- Existing modal names/focus/Escape, form associations, keyboard ordering, mobile 44×44 targets and overflow tests remain intact.
- This is not a complete manual WCAG audit; PDF accessibility, every theme/screen and assistive-technology combinations remain outside the automated claim.

## Final product audit

- All declared runtime routes are reachable through `App.tsx`; no abandoned page module was found.
- No `TODO`/`FIXME` production placeholders were found.
- Runtime dependencies are referenced by shipped code; no dependency was removed solely on a static guess.
- Developer-only Error Boundary details remain guarded by `import.meta.env.DEV` and are removed from production behavior.
- Supabase sync, Workspace remote-wins, Show conflict choices, locks, authentication, Input List functional rules, PDF functional content, delete semantics and return collision policy were not changed.

## Contradictions and known limitations

1. **Undo vs remote delete (release-significant, unresolved):** an immediate Undo replaces a still-pending `show-delete` with a serialized upsert for the same queue key. If the remote delete has already completed, restoration can race with sync revision state and may require conflict resolution. Exact permanent-delete/Undo semantics is an open Decision Log item. Milestone 4 documents this behavior and intentionally stops before changing it. Acceptance remains open.
2. **Return collisions (unresolved by instruction):** stereo labels consume consecutive outputs, but overlap detection is not implemented. Documentation now requires manual review. Acceptance remains open.
3. **First offline visit:** unsupported. A successful controlled online load is required; lazy routes become offline-capable after request.
4. **Open editor security:** RLS deliberately allows anonymous editing. Publishable keys are public; possession of the editor URL grants mutation access.
5. **Classic `config.js` build warning:** Vite reports that the non-module runtime script cannot be bundled. It is intentionally copied as a runtime-editable file and does not affect build success.

## Verification status

Local candidate evidence completed so far:

- lint: passed;
- test typecheck: passed;
- unit/component: 124/124 passed;
- build: passed;
- Pages production E2E: 1/1 passed, retries 0;
- Pages axe scan: passed after the contrast correction;
- local Playwright without backend: 3 passed / 10 Supabase scenarios skipped / 0 failed / retries 0;
- local integration without backend: 0 passed / 22 skipped / 0 failed.

The local skips above are expected environment limitations and do not satisfy acceptance. The exact Bash secrets scan is not executable in this Windows environment without Bash/WSL. Real Supabase-from-empty, 22 integration tests and all 13 configured E2E tests must be re-run by final branch CI before release recommendation. Until that run succeeds, this document records a **candidate**, not a release approval.
