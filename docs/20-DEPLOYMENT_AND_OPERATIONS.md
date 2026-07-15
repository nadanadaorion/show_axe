# Deployment and operations

## GitHub Pages build

```bash
npm ci
npm run lint
npm run test --if-present
npm run build
```

Publish the contents of `dist/`:

```text
index.html
config.js
sw.js
assets/
```

## Runtime configuration

Edit deployed `config.js`:

```js
window.__ORION_CONFIG__ = {
  supabaseUrl: 'https://PROJECT.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
}
```

Never commit a service-role or secret key.

## Supabase setup

Run `supabase/SETUP.sql` in Supabase SQL Editor for a fresh project. For later releases, use versioned migrations and verify before deploying frontend changes that depend on them.

For local development/testing, `supabase/config.toml` configures the Supabase CLI's local stack
(`supabase start`, requires Docker); it applies every migration under `supabase/migrations/` automatically
from empty. Copy `.env.example` to `.env` and fill in `SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY` (from
`supabase status`) to run the Supabase-backed test suites — see `docs/19-TESTING_STRATEGY.md`. Verify a
deployed schema with `supabase/VERIFY.sql`, or run `npm run test:supabase:sql` for a self-checking pass that
works without Docker (native Postgres only; see that script's header for exactly what it does and does not
prove).

## Deployment order

For backward-compatible schema changes:

1. database migration;
2. verification;
3. frontend deployment;
4. smoke test.

For breaking changes, use expand-and-contract migrations so old and new frontend versions can coexist during cache propagation.

## Service Worker updates

- Change the explicit `CACHE_NAME` suffix in `public/sw.js` for every release that modifies shell or
  Service Worker behavior (current Milestone 3 correction: `orion-shows-v2.0.0-m3.1`). Never reuse the
  active worker's cache name for a new deployment.
- Ensure old caches are removed during activate.
- Provide a visible update/reload prompt if an old tab is controlling stale assets — implemented in
  Milestone 3, see `docs/18-TECHNICAL_ARCHITECTURE.md` "Service Worker" → "Update flow".
- Test hard refresh and ordinary refresh after deployment.
- Test install-while-an-old-tab-is-open, explicit activation, offline reopen, and cleanup that leaves
  unrelated caches untouched.

## Backup and recovery

Before major release:

- export a JSON backup;
- retain SQL/database backup where available;
- document deployed commit SHA;
- verify public links;
- verify one full create/edit/export flow.

Recovery paths:

- restore JSON locally and resynchronize;
- restore Supabase backup;
- redeploy prior `dist/`;
- clear Service Worker/site data only as a last resort because it removes offline local changes.

## Operational monitoring

Without accounts or telemetry, minimum operational checks are manual:

- editor loads;
- sync status reaches synchronized;
- second device receives a new Show;
- lock blocks correctly;
- public route loads;
- PDF exports;
- offline reload works.
