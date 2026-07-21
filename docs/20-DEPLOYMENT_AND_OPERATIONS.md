# Deployment and operations

## Supported release shape

- Static Vite build hosted under a repository subpath.
- `HashRouter`; no server rewrites are required for application routes.
- Runtime Supabase configuration in a classic `config.js` loaded before the app.
- Project URL plus publishable/legacy anon key only.
- Service Worker scoped to the deployed base path.
- Application version sourced once from `package.json`.

## Reproduce the Pages artifact

```bash
npm ci
npm run lint
npm run test
npm run typecheck:tests
npm run build:pages
npm run test:pages
npm run check:secrets
```

`build:pages` uses `/show_axe/`. `test:pages` serves that actual artifact and verifies direct navigation, assets, a public lazy chunk, reload, offline reopen, SW URL/version/scope and an automated accessibility scan.

For another repository name set an appropriate Vite base and update the corresponding deployment test before shipping. A custom domain is optional and requires the same validation.

To run the app for a different team (its own name, subtitle, accent color and Supabase project) see `docs/27-BRANDING_AND_WHITE_LABEL.md`. Branding is optional runtime config; unset values keep the defaults. On GitHub Pages, set the optional `BRAND_NAME`, `BRAND_TAGLINE`, `BRAND_ACCENT`, and `BRAND_ACCENT_TEXT` Actions variables alongside the Supabase ones.

## GitHub Pages workflow

Repository setup:

1. Pages Source: **GitHub Actions**.
2. Actions variables:
   - `SUPABASE_URL=https://PROJECT.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY=sb_publishable_...` or the legacy anon key.
3. Run **Deploy GitHub Pages** manually on an approved `main` SHA.

`.github/workflows/deploy-pages.yml` runs clean install, lint, unit/component tests, typecheck, Pages build, runtime-config generation, secret scan and official Pages upload/deploy actions. It rejects a missing/malformed URL, a short key and secret/service-role patterns. It never requests a secret key.

The workflow is manual deliberately: CI success does not publish, tag or release automatically.

## Supabase installation and migration order

Fresh project:

1. Create project.
2. Run `supabase/SETUP.sql` in SQL Editor, or use Supabase CLI so `supabase/migrations/` runs in order.
3. Run `supabase/VERIFY.sql`.
4. Configure the public runtime values.
5. Deploy and smoke test.

Update:

1. Export JSON and retain a database backup.
2. Apply versioned, backward-compatible migrations.
3. Verify tables, indexes, constraints, functions/RPC, triggers, RLS, Realtime publication, replica identity, locks and public slugs.
4. Deploy frontend.
5. Validate editor, two-device sync, public link, PDF and offline reopen.

Never run integration/E2E against production; those suites mutate and delete records.

## Service Worker lifecycle

The client registers `<base>/sw.js?v=<package version>` with scope `<base>/`. `public/sw.js` derives `orion-shows-<scope>-v<version>`, deletes only older caches for that exact normalized scope and leaves IndexedDB, sibling projects and unrelated caches untouched.

Install does not call `skipWaiting`. A new worker waits until the user accepts the visible update. `controllerchange` causes one reload only while an update initiated by the UI is active; an eight-second timeout exposes retry rather than spinning forever.

Operational limitations:

- first visit requires network;
- one online controlled reload is needed before the complete shell is proven offline;
- lazy chunks are cached after first request, not all precached;
- config uses network-first with cache fallback;
- clearing site data destroys IndexedDB, local backups and pending sync.

## Backup and recovery

Before every deployment:

- export JSON;
- record deployed SHA and version;
- retain Supabase backup where available;
- confirm no pending/offline mutations on the administrative browser.

If Supabase is unavailable, keep the browser data intact, export JSON if the UI allows it, avoid concurrent offline editing and wait for recovery. If the frontend is bad but schema is compatible, redeploy the prior known-good SHA. Full steps are in `docs/ROLLBACK_2.0.0.md`.

## Release procedure

1. Final CI run on the candidate: all jobs success, zero failed/skipped/retries in required suites.
2. Review acceptance criteria and known limits.
3. Approve and merge the milestone PR.
4. Deploy `main` manually and perform production smoke checks.
5. Only after explicit approval, create annotated tag `v2.0.0` on the verified merge SHA and publish release notes.

Do not reuse a tag, force-push `main`, publish from an unmerged branch or clear client storage as part of normal deployment.
