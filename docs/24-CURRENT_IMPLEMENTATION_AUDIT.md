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
- Local measured bundle: entry 252.19 kB / 79.25 kB gzip; PDF chunk 424.27 kB / 139.20 kB gzip; largest eager vendor 214.64 kB. No Vite 500 kB warning.

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
- Later CI runs `29456494861` and `29456764783` exposed test orchestration races: desktop opened Input List before its Equipment saves were guaranteed complete, while mobile could associate an action with a still-finishing prior sync cycle. Desktop now uses the shared online-save helper for creation/additions, and that helper first requires a settled `Guardado en línea` baseline before observing the action-specific cycle. Product synchronization behavior was not changed.
- Existing modal names/focus/Escape, form associations, keyboard ordering, mobile 44×44 targets and overflow tests remain intact.
- This is not a complete manual WCAG audit; PDF accessibility, every theme/screen and assistive-technology combinations remain outside the automated claim.

### Monotonic Show revisions

- Root cause: Realtime delivery is not ordered relative to RPC responses. The receiver rejected only
  an equal revision, so a delayed revision-1 `INSERT` could be applied after newer Show content. A
  second race was exposed by the repeated gate: queue coalescing reused the same Show mutation ID,
  and completion of an older in-flight RPC could delete a newer local payload before its save.
- `applyRemoteShow` is the centralized application point for initial fetches, Realtime rows,
  successful save responses and conflict-resolution rows. It serializes application and compares
  `incomingRevision` with the last accepted remote revision in IndexedDB `syncRecords`.
- Lower revisions are ignored completely; equal revisions are idempotent; higher revisions follow
  the existing pending-mutation guard. Neither lower nor equal payloads write Zustand, snapshots or
  revision records.
- Show queue entries carry a local generation. Successful RPC completion removes only the generation
  actually sent. If a newer payload was coalesced while the RPC was in flight, it remains queued and
  its `expectedRevision` is atomically rebased to the accepted server revision.
- Show conflict choices and Workspace remote-wins are unchanged. Remote DELETE has no comparable
  revision payload and retains its previous treatment, as required.
- Deterministic tests cover lower/equal/higher revisions, no-write behavior, all protected Show
  sections, save-then-old-INSERT, out-of-order 3/2, pending edits, same-device echoes and the
  in-flight coalescing race. Real Supabase integration covers a pre-subscribed second client; the
  browser regression checks the subscribed UI and remote Equipment/Input List and runs 20 times in
  CI with zero retries.

## Final product audit

- All declared runtime routes are reachable through `App.tsx`; no abandoned page module was found.
- No `TODO`/`FIXME` production placeholders were found.
- Runtime dependencies are referenced by shipped code; no dependency was removed solely on a static guess.
- Developer-only Error Boundary details remain guarded by `import.meta.env.DEV` and are removed from production behavior.
- Supabase sync, Workspace remote-wins, Show conflict choices, locks, authentication, Input List functional rules, PDF functional content, delete semantics and return collision policy were not changed.

## Sonic Grunge visual layer

The `codex/sonic-grunge-redesign` candidate is based on `main` at `c112af9f5e3363c870efaefe22a96d0248606a79`. Its scope is deliberately presentational:

- shared colors, typography, surfaces, controls, navigation, status treatments and responsive composition now follow `docs/SONIC_GRUNGE_DESIGN_SYSTEM.md`;
- Anybody is shipped as a local OFL-1.1 WOFF2 asset, so the identity does not depend on a network font request;
- CSS texture uses a lightweight repeating gradient and does not introduce a bitmap payload;
- the existing lazy-route and dynamic-PDF boundaries remain intact;
- no route, label, control, store, IndexedDB schema, Supabase path, synchronization rule, lock/conflict rule, Service Worker behavior, Input List mapping or PDF content changed.

Measured production bundle before/after the visual layer:

- eager entry: 252.19 kB / 79.25 kB gzip → 254.13 kB / 79.79 kB gzip;
- CSS: 23.60 kB / 5.60 kB gzip → 29.99 kB / 6.80 kB gzip;
- local Anybody font: +24.05 kB (browser-compressed WOFF2);
- PDF chunk: unchanged at 424.27 kB / 139.20 kB gzip;
- largest eager vendor: unchanged at 214.64 kB / 55.52 kB gzip;
- no Vite 500 kB chunk warning.

Local redesign verification: lint passed; test typecheck passed; 135/135 unit/component tests passed; production build passed; 5/5 locally runnable browser E2E passed with 11 real-Supabase scenarios skipped, 0 failed and retries disabled; Pages/offline passed 1/1. Real-Supabase integration, blocked-lock visual state and the Linux secret scan remain CI evidence requirements for the final commit.

## Contradictions and known limitations

1. **Undo vs remote delete (release-significant, unresolved):** an immediate Undo replaces a still-pending `show-delete` with a serialized upsert for the same queue key. If the remote delete has already completed, restoration can race with sync revision state and may require conflict resolution. Exact permanent-delete/Undo semantics is an open Decision Log item. Milestone 4 documents this behavior and intentionally stops before changing it. Acceptance remains open.
2. **Return collisions (unresolved by instruction):** stereo labels consume consecutive outputs, but overlap detection is not implemented. Documentation now requires manual review. Acceptance remains open.
3. **First offline visit:** unsupported. A successful controlled online load is required; lazy routes become offline-capable after request.
4. **Open editor security:** RLS deliberately allows anonymous editing. Publishable keys are public; possession of the editor URL grants mutation access.
5. **Classic `config.js` build warning:** Vite reports that the non-module runtime script cannot be bundled. It is intentionally copied as a runtime-editable file and does not affect build success.

## Verification status

Local candidate evidence:

- lint: passed;
- test typecheck: passed;
- unit/component: 135/135 passed;
- build: passed;
- Pages production E2E: 1/1 passed, retries 0;
- Pages axe scan: passed after the contrast correction;
- local Playwright without backend: 3 passed / 11 Supabase scenarios skipped / 0 failed / retries 0;
- local integration without backend: 0 passed / 23 skipped / 0 failed.

The local skips above are expected environment limitations and do not satisfy acceptance. The exact Bash secrets scan is not executable in this Windows environment without Bash/WSL.

Historical functional-candidate CI run `29456162914` on `ecc14f5d61a84b0ce75add0969fa8c02968bb4c2` completed successfully: 124/124 unit/component, 22/22 real Supabase integration, 1/1 Pages production and 13/13 configured E2E passed, with zero failed tests, zero required skips and zero retries. The source/`dist/` secret scan passed.

Runs `29456494861` (desktop smoke), `29456764783` (mobile Equipment) and `29457361000` (mobile smoke) exposed loss of newly added Equipment around online synchronization. The authorized correction was implemented in `d79aaeb` and `fb58451`. Code-candidate run `29460043696` passed: 135/135 unit/component, 23/23 real Supabase integration, 1/1 Pages, 14/14 configured E2E and 20/20 dedicated stress repetitions, with zero test failures, required skips or retries; migrations from an empty stack, build and secret scan also passed. This proves the correction, but merge/release remains unapproved until three complete consecutive runs succeed on the final documentation SHA and the owner explicitly approves.
