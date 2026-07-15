# Backlog

Items here are not approved scope unless moved into the decision log.

## High-value candidates

- Soft delete with retention before permanent remote deletion.
- Input/return overlap validation.
- Duplicate-person detection with explicit override.
- Stagebox/patch presets.
- CSV export for Input List.
- Printer-specific PDF templates.
- Change history/audit feed.
- Shared edit passphrase without individual accounts.
- Separate device-local and shared preferences.

## Technical debt

- Split large Zustand store into tested domain services.
- Add schema validation with a runtime validator.
- Add typed Supabase-generated database definitions.
- Add structured logging behind development flag.
- Cap and manage automatic backup retention.
- Keep monitoring bundle-size budget as the app grows (Milestone 3 split routes + `@supabase/supabase-js`/
  `dexie` into separate chunks and cleared the 500 kB warning; re-evaluate if any chunk crosses it again).
- Test `pagehide` lock release across browsers.
- Bring the Equipment reorder buttons and other dense-row controls up to the ~44×44 CSS px touch-target
  guideline without regressing row density (see `docs/24-CURRENT_IMPLEMENTATION_AUDIT.md` "C. Mobile-
  responsive Equipment/Input List").

## Explicitly not planned

- financial modules;
- inventory stock counts;
- ticketing;
- chat;
- real-time multi-cursor collaboration;
- user accounts, until the product owner changes that decision.
