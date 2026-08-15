# ADR 0006 — Authenticated editor access

Status: Accepted by product owner (2026-08-15). Supersedes ADR 0002 and decisions D-201/D-202.

## Context

ADR 0002 recorded an explicit product-owner rejection of accounts: anyone with the editor URL could read
and mutate everything. The product owner has now reversed that decision and requires the editor to be
protected by a username and password that cannot be bypassed by inspecting the shipped client.

That requirement cannot be met in the client. `public/config.js` necessarily exposes the Supabase project
URL and publishable key, and the current policies are `for all to anon using (true) with check (true)`.
Anyone holding those two public strings can read, modify and delete every row over plain HTTP without
loading the application at all. A password gate rendered in React would stop nobody.

A second, previously undocumented consequence of the same policies: the anonymous role holds `select` over
the whole `orion_shows` table, so the "public read-only link" restricts nothing at data level. Any visitor
can enumerate every Show, including archived ones that were never shared.

## Decision

Authenticate the editor with Supabase Auth (e-mail plus password) and make the database, not the UI, the
enforcement point. Policies move from `anon` to `authenticated`, and authorisation is membership in a new
`orion_app_users` registry rather than any hardcoded identity.

Specifically:

- passwords are hashed and verified server-side by GoTrue; the application never stores or sees them;
- the editor client persists its session and refreshes tokens automatically;
- every RPC is `security definer` and therefore bypasses RLS, so the `execute` grant is the only gate on
  it — each mutating RPC is regranted to `authenticated` alone;
- the public route is served by a single `security definer` accessor requiring an exact slug, which is the
  only function anonymous visitors may execute;
- there is no signup screen, and e-mail signups are disabled in the Supabase project. Accounts are created
  by an operator in the dashboard and granted membership with `orion_add_member`.

Rollout is staged so the deployed application is never locked out of its own data: the additive migration
and account creation come first, then the client that can log in, then production verification, and only
then the migration revoking anonymous access.

## Consequences

- Possession of the editor URL no longer grants access; the publishable key alone reads and writes nothing.
- Shows can no longer be enumerated anonymously; a public visitor must hold the exact slug.
- The public route loses Realtime, because Realtime respects RLS. It refreshes on focus and on demand.
  Accepted as the cost of leaving no anonymous access to the table.
- Adding a second person is an account plus one registry row — no code change, no redeploy. The `role`
  column is present from the outset and unused, so read-only members can be introduced by amending
  policies alone.
- Local-first behaviour is preserved. A device that has authenticated before continues to read and edit
  its local data while offline or with an expired session; only synchronisation is withheld. This weakens
  nothing server-side, where a valid token remains mandatory for every write.
- Login is unavailable without connectivity, which is precisely why offline editing must not be gated on a
  live session.
- IndexedDB remains readable through developer tools on the device itself. This decision protects the
  shared backend and the URL, not local data at rest; encrypting it is out of scope and would require
  deriving a key from the password, defeating both persistent sessions and offline start-up.
- Password recovery is performed from the Supabase dashboard. No SMTP is configured and no reset route
  exists in the application.
- The integration and end-to-end suites authenticate as anonymous today and must all be migrated to a
  dedicated test account.
