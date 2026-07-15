# Public read-only Show view

## Route

`#/public/:slug`

## Data source

Fetch the current Show by `public_slug`. Public view always reflects the latest synchronized remote version.

## Visible sections

- Show name and metadata;
- general note;
- Equipment and readiness status;
- People and roles/contact data where appropriate;
- Schedule;
- Input List;
- Monitor returns;
- technical notes.

## Read-only requirements

- No inputs, edit buttons, archive/delete controls, Preset actions, or sync conflict controls.
- No editor sidebar.
- Do not expose internal IDs, revisions, client IDs, or lock details.

## Lifecycle

- Active Show: available.
- Archived Show: remains available.
- Deleted Show: not found.
- Slug never changes during normal Show edits.

## Privacy warning

Because the backend allows anonymous select access and the editor is intentionally open, public read-only mode is a UI mode, not a secure authorization boundary. Do not describe it as access-controlled.
