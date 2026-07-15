# Design principles and scope

## Core principles

### The Show is the center

All operational information belongs to a Show. Library and Presets exist to accelerate creation, not to replace the Show.

### A Show is a snapshot

Copy reusable data into a Show. Never retain behavior that causes future Library edits to mutate a Show that already exists.

### Create first, configure afterward

Creating a Show requires only a name. Date, time, type, source Show, and Preset are optional. After creation, open the workspace immediately.

### Progressive complexity

Basic use remains simple. Advanced details such as per-unit assignments, Input List synchronization, patching, phantom power, and monitor returns appear only when needed.

### Catalogs help, never block

Any catalog-backed field must permit free creation or free text where specified. The user must not be forced to maintain the Library before using the application.

### Contextual editing

Prefer inline fields, expandable rows, and focused modals over separate edit pages.

### Undo over confirmation

Use reversible actions with a Toast action for routine deletion where recovery is feasible. Use confirmation only for irreversible or security-sensitive actions.

### Stable user intent

Never silently replace custom channel numbers, edited Input List labels, manual rows, or manually selected conflict outcomes.

## V1 scope

- local Shows;
- Equipment, People, Information, Schedule;
- Library and Presets;
- Preferences;
- JSON import/export;
- automatic local backups;
- no accounts or external integrations.

## V1.1 scope

- per-unit equipment assignments;
- generated Input List;
- monitor returns;
- update preview preserving manual edits;
- PDF export in both orientations;
- editable channel numbers.

## V2 scope

- shared Supabase backend;
- no accounts;
- anyone with editor URL can edit;
- offline-first local queue;
- conflict choice: local or online;
- Show edit lock with ten-minute inactivity expiry;
- no force unlock;
- permanent public read-only link;
- V2 begins with a new local database and does not automatically migrate V1.

## Explicitly deferred

- authentication;
- permissions or roles;
- protected public links;
- real-time co-editing inside one Show;
- inventory quantities or availability;
- financial data;
- attachments and file storage;
- messaging or notifications;
- third-party integrations.
