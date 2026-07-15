# Rollback package for V2.0.0

This is the data-preserving rollback procedure. It does not contain a second binary artifact because GitHub Pages can reproducibly redeploy any known-good commit.

## Before deployment

Record:

- current production commit SHA and workflow run;
- candidate commit SHA and version;
- exported Ori♡n JSON;
- Supabase backup/snapshot availability;
- migrations applied;
- whether any browser reports pending offline changes.

Do not deploy while an administrative browser has pending mutations.

## Frontend-only rollback

Use when schema remains backward compatible:

1. Stop normal editing and tell operators not to clear browser data.
2. In Actions, run the Pages workflow on the previously recorded good `main` SHA (or a temporary approved rollback branch containing exactly that tree).
3. Verify URL, `config.js`, editor load, sync, public link and offline reopen.
4. Open tabs may receive the older worker as a new script URL/cache. Accept the visible update after edits are safe.
5. Confirm IndexedDB data and pending mutations remain present.

## Database rollback

Only if a migration is proven incompatible:

1. Stop writes.
2. Export JSON if any client can still read state.
3. Restore the Supabase backup or apply a reviewed reverse migration.
4. Run the verification script compatible with the restored frontend.
5. Redeploy the matching frontend SHA.
6. Validate with a non-production smoke record before reopening editing.

Never improvise destructive SQL, run `RESET_DATA.sql`, or clear client storage as a rollback shortcut.

## If Supabase is down

- Leave site data intact.
- Export JSON if available.
- Avoid multi-device offline edits.
- Restore backend service first, then allow queued changes to flush while watching for conflicts.

## Rollback success criteria

- editor and public routes load;
- sync reaches “Guardado en línea”;
- a second device receives a safe test change;
- no unexpected pending mutations/conflicts;
- public link and PDF work;
- prior local data remains available;
- deployed SHA is recorded.
