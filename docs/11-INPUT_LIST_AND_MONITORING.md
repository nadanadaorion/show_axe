# Input List and monitoring

## Purpose

The Input List converts per-unit equipment uses into an editable technical channel list without forcing equipment to be split into separate quantity lines.

## Opening behavior

The Input List can always be opened.

When one or more equipment lines are unchecked and warnings are enabled:

- show the pending count;
- allow `Continue`;
- allow `Do not show again`;
- retain a Preferences control to restore warnings.

## Initial generation

For every Show Equipment item where `includeInInputList !== false`:

1. normalize assignments to quantity;
2. create one row per assignment;
3. set `use` from assignment use;
4. set `equipment` from equipment name;
5. assign a channel beginning at `channelStart`;
6. store equipment and assignment provenance.

## Input columns

Required initial columns:

- CH;
- Use;
- Equipment;
- Phantom;
- Patch;
- Notes.

Rows can also be added manually.

## Channel behavior

- `CH` is editable as text.
- Input Lists may begin at any positive channel number.
- `Channel start` plus explicit `Renumber` applies a consecutive numeric sequence.
- Drag/reorder never changes channels.
- New generated or manual rows use the next number after the highest existing numeric channel.
- A user-entered non-numeric label is valid and preserved.

## Update from Equipment

The operation is explicit and previewed.

Preview categories:

- additions;
- removals;
- source updates.

Preservation algorithm:

- Match generated rows by equipment ID + assignment ID.
- Keep channel, phantom, patch, notes, and order.
- Compare current `use` to stored `sourceUse`.
- Compare current `equipment` to stored `sourceEquipmentName`.
- If the user changed a field, preserve the user value.
- If the user did not change it, update from the source.
- Never remove manual rows.
- Remove missing generated rows only after confirmation.

## Monitor returns

Returns are shown below inputs in the same modal.

Fields:

- destination;
- system;
- mono/stereo;
- output start;
- calculated output label;
- notes.

Examples:

- Mono at output 3 → `AUX 3`.
- Stereo at output 5 → `AUX 5–6`.

V2.0 displays each mono/stereo allocation but does not detect overlaps. Collision handling remains an explicit open decision; operators must review outputs manually.

## Persistence

The complete Input List is stored inside its Show. Closing and reopening the modal preserves:

- rows;
- custom channels;
- row order;
- manual edits;
- returns;
- notes;
- synchronization metadata.

## PDF export

Supported orientations:

- portrait compact;
- landscape technical.

The PDF contains:

- Ori♡n Shows identification;
- Show name;
- date, time, and type when present;
- Input table;
- monitor returns table;
- general notes;
- page numbers for multi-page output.

PDF values must match stored values, especially custom CH and stereo output ranges.

## Acceptance-sensitive cases

- two identical microphone models with different uses;
- quantity increase/decrease;
- excluded equipment;
- blank use;
- manual row;
- edited generated row;
- reordering with custom channels;
- generated additions after channels beginning at 17;
- stereo return allocation;
- multiple-page PDF.
