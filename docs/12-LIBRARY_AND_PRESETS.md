# Library and Presets

## Library purpose

The Library stores reusable data. It accelerates Show preparation but is never mandatory.

Sections:

- Equipment;
- People;
- Categories;
- Roles/functions;
- Person types;
- Origins.

## Library rules

- Full create, edit, archive/delete, and search behavior.
- Equipment may reference a Library category and origin.
- People may reference multiple Library roles and types.
- Archived Library items do not appear as default choices but remain valid historical provenance.
- Deleting a Library item does not affect Shows or Presets that copied it.

## Preset purpose

A Preset captures reusable Show structure:

- equipment categories;
- equipment and assignments;
- people;
- schedule;
- optional Show type and note.

## Preset lifecycle

- create from Show;
- edit;
- duplicate;
- archive/restore;
- delete;
- apply to Show.

## Apply modes

### Merge

- Add Preset content to existing Show content.
- Remap all IDs.
- Avoid category identity collisions.
- Preserve existing Show data.
- Do not automatically merge Input List; the user can synchronize from Equipment afterward.

### Replace

- Replace Show Equipment categories, Equipment, People, and Schedule with remapped Preset content.
- Preserve Show identity, public slug, name, date, time, archive state, and general metadata unless explicitly included by the apply operation.
- Existing Input List behavior must be explicit: recommended behavior is preserve it and show that it is out of sync, rather than silently deleting technical work.

## Snapshot behavior

Preset edits do not mutate Shows already created from that Preset.
