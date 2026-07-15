# Backlog

Items here are not approved scope unless moved into the decision log.

## High-value candidates

- Soft delete with retention before permanent remote deletion.
- Service Worker update banner.
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
- Code-split PDF dependencies.
- Add typed Supabase-generated database definitions.
- Add structured logging behind development flag.
- Cap and manage automatic backup retention.
- Improve bundle-size budget.
- Test `pagehide` lock release across browsers.

## Explicitly not planned

- financial modules;
- inventory stock counts;
- ticketing;
- chat;
- real-time multi-cursor collaboration;
- user accounts, until the product owner changes that decision.
