# Security and privacy model

Superseded the original open-access model on 2026-08-15. See `docs/adr/0006-authenticated-editor-access.md`
and D-215 to D-221.

## Model

The editor requires an authenticated account that is a member of `orion_app_users`. Access is
enforced by Postgres policies and RPC grants, not by the client. Public Show routes remain reachable
without a session, through one slug-scoped accessor.

## Why enforcement cannot live in the client

`public/config.js` necessarily exposes the Supabase project URL and publishable key; the application
cannot function without shipping them. Anything the `anon` role is granted is therefore reachable by
anyone, over plain HTTP, without loading the application:

```
curl "https://<project>.supabase.co/rest/v1/orion_shows?select=*" -H "apikey: <publishable key>"
```

A password prompt rendered in React changes nothing about that request. Any future access rule must
be added as a policy or a grant; a client-side check is a UI affordance, never a boundary.

## The two load-bearing properties

- **RPC grants are the real gate.** Every RPC is `security definer` and runs as its owner, bypassing
  RLS completely. Tightening table policies while leaving an `execute` grant to `anon` leaves the
  whole scheme bypassable through the RPC.
- **Authorisation is membership, not authentication.** Policies test `orion_is_member()`. A stranger
  who self-registers — should signups ever be re-enabled by accident — authenticates successfully and
  is still denied by every policy.

## What is protected

- Editor data cannot be read or written without a session belonging to a member.
- The Show catalogue cannot be enumerated anonymously. A public visitor must hold an exact slug.
- The member registry, which carries the e-mail addresses of everyone with access, is unreadable
  without a session and unwritable from the application at all.
- Membership can only be granted from the Supabase SQL editor, so a compromised browser session
  cannot hand out access.

## What is not protected

- **Local data at rest.** IndexedDB stays readable through developer tools on the device itself.
  Authentication protects the shared backend and the URL, not the local cache. Encrypting it would
  require deriving a key from the password, which defeats both persistent sessions and offline
  start-up; the mitigation is operating-system screen locking.
- **The session token on the device.** It is stored in local storage, is short-lived and is scoped to
  that browser. Its exposure to the device's own user is not a vulnerability.
- **A device in the offline grace state.** After a real sign-in, local data stays readable and
  editable without a live session (D-218). Nothing can be synchronised in that state.
- **Attribution of individual edits.** Shows carry no per-user history. Locks identify a member, but
  that is an operational hint, not an audit log.

## Required safeguards

- Keep e-mail signups disabled in Authentication → Providers → Email.
- Never expose service-role or secret keys. `npm run check:secrets` scans source and `dist/`.
- Grant every new RPC to `authenticated` alone unless it is deliberately public.
- Validate imported JSON and database payloads.
- Escape/render text safely; do not inject user content as HTML.
- Apply reasonable length limits to free-text fields.
- Keep automatic local and downloadable backups.
- Avoid logging personal contact data unnecessarily.

## Deferred hardening

Not in scope unless separately decided:

- differentiated roles (the `role` column exists and is not yet enforced);
- audit log of edits;
- soft delete and server-side retention;
- multi-factor authentication;
- encryption of local data at rest;
- IP/network restriction.
