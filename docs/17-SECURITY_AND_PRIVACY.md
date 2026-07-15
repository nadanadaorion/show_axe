# Security and privacy model

## Deliberate model

There are no accounts or authentication in V2. Anyone who knows or discovers the editor URL can read and mutate all shared data.

This choice optimizes friction, not confidentiality.

## Consequences

- GitHub Pages URL is public unless external hosting controls are added.
- Supabase publishable key is safe to expose only because RLS/policies define access; in this product those policies are intentionally open.
- Public read-only links do not prevent a visitor from navigating to the editor root.
- There is no attribution of edits to a person.
- Device labels are operational hints, not identities.
- A malicious visitor can alter or delete data.

## Required safeguards despite open access

- Never expose service-role or secret keys.
- Validate imported JSON and database payloads.
- Escape/render text safely; do not inject user content as HTML.
- Apply reasonable length limits to free-text fields.
- Keep automatic local and downloadable backups.
- Document recovery from accidental or malicious deletion.
- Avoid logging personal contact data unnecessarily.

## Recommended future hardening without full accounts

Deferred options:

- unguessable editor URL plus separate public domain;
- hosting-level password protection;
- shared edit passphrase verified by an Edge Function;
- IP/network restriction;
- audit log;
- soft delete and server-side retention;
- rate limiting.

None of these are part of the approved V2 scope unless separately decided.
