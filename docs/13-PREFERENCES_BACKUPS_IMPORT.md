# Preferences, backups, and import/export

## Preferences

- initial module: Shows, Library, or Presets;
- date format;
- time format;
- language setting;
- light, dark, or system theme;
- show/hide incomplete-equipment Input List warning.

Preferences are shared in V2 according to the current workspace model. A later change to device-local preferences requires an explicit decision and migration.

## JSON export

Export a versioned `AppSnapshot` containing:

- Shows;
- Presets;
- Library;
- Preferences;
- export timestamp.

Do not include Supabase keys, local client IDs, locks, sync queue records, or browser-only metadata.

## JSON import

Before mutation:

- parse safely;
- validate supported version;
- validate required collection shapes;
- normalize older compatible fields;
- reject clearly invalid data with actionable feedback;
- create a local backup.

Modes:

### Replace

Replace local application data with imported snapshot and queue the resulting shared state intentionally.

### Merge

Merge by IDs while preserving existing data where IDs do not collide. Collision behavior must be deterministic and documented.

## Automatic backups

- Stored in IndexedDB.
- Rotated or capped to prevent unbounded storage growth.
- Created on a reasonable interval and before risky import/replace operations.
- Restoring a backup is a user-visible operation.

## V1 to V2

V2 deliberately starts with a separate local database. There is no automatic migration. V1 data may be moved using JSON export/import.
