# Troubleshooting

## The app shows “Conectar Supabase” in production

Check `https://<host>/show_axe/config.js`. It must contain the Project URL and publishable/anon key. Confirm Actions variables exist and rerun the manual Pages workflow. Never paste a secret/service-role key.

## “No se pudo conectar” or sync stays in error

Confirm the Supabase project is healthy, URL ends in `.supabase.co`, migrations/`SETUP.sql` completed and `VERIFY.sql` passes. Browser/network blockers can block Supabase or WebSockets; fallback polling should still recover normal reads.

## There are pending changes offline

Do not clear storage or uninstall the site. Reconnect, keep the tab open and wait for “Guardado en línea”. If a conflict appears, compare local/online choices. Export JSON before risky recovery.

## Two people edited the same Show

Online locks normally block the second editor. Offline locks cannot be checked. On conflict, choose the intended local or online version; neither is silently overwritten. Workspace data (Library, Presets, Preferences) follows remote-wins by approved policy.

## Undo did not restore a remotely deleted Show everywhere

Immediate Undo can replace a deletion still queued locally. If deletion already reached Supabase, restoration can conflict with remote revision/deletion state. This edge is an open V2.0 decision. Preserve local data, export JSON, inspect the conflict and do not repeatedly delete/restore.

## Import is rejected

Use a JSON export produced by Ori♡n Shows. The file must have supported version, timestamp, Shows/Presets, complete Library collections and Preferences. Invalid JSON and incompatible nested records are rejected before data changes. A local backup is created before a valid import is applied.

## PDF does not download

Allow downloads for the site, retry after the PDF chunk loads and use the Error Boundary recovery if shown. Long lists are multipage. Check return output overlaps manually; V2.0 does not validate collisions.

## Offline reload is blank or a route is unavailable

The first visit must be online. Reload once online after the worker installs, and visit lazy screens at least once before expecting them offline. If a deployment happened, accept the update notice online before testing offline again.

## Update notice does not finish

Use **Reintentar**, then close other tabs for the same installation if necessary. Do not clear site data while changes are pending. The update does not intentionally remove IndexedDB.

## Pages assets return 404

Build with `npm run build:pages`; do not publish a root-base build to the repository URL. Confirm the URL contains `/show_axe/` and the SW scope ends in the same path.

## Suspected secret exposure

Stop deployment, rotate the exposed key in Supabase and inspect Git history/artifacts. A publishable/anon key is public by design, but a secret/service-role key must never be in frontend config. Run `npm run check:secrets` in Bash/Linux and do not resume until clean.
