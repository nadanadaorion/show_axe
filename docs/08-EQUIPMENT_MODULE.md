# Equipment module

## Categories

Each Show has its own editable category list. Initial categories are copied from active Library categories.

Supported actions:

- add;
- rename;
- move up/down;
- delete with defined reassignment behavior;
- drag equipment between categories.

Deleting a category that contains equipment must either move those lines to another category or require choosing a destination. It must not orphan rows.

## Equipment line

Primary compact view:

- checkbox/readiness state;
- name;
- quantity and optional unit;
- assignment summary;
- optional origin;
- progress/assignment state where useful.

Expanded edit view:

- quantity;
- unit;
- origin;
- notes;
- include in Input List;
- one free-form use field per unit;
- category movement;
- duplicate;
- delete.

## Adding equipment

Two paths:

1. copy from Library;
2. create freely within the Show.

Copying from Library imports the current values into the Show. Subsequent Library edits do not propagate.

## Quantity and assignments

Example:

```text
Shure SM58 — Quantity 2
  Unit 1: Snare Up
  Unit 2: Snare Down
```

The Show list still displays one grouped equipment line. Assignments are internal units used primarily by Input List generation.

## Input List inclusion

- New equipment defaults to included.
- The user may disable inclusion per line.
- Disabling inclusion does not delete existing Input List rows immediately. The next explicit synchronization preview reports the generated rows that would be removed.

## Progress

- A line is complete when `checked` is true.
- Category progress = checked lines / total lines in category.
- Overall progress = checked lines / total equipment lines.
- Quantity does not multiply progress; progress represents preparation of grouped lines.

## Search and ordering

Search matches equipment name, origin, notes, and assignments when practical. Manual order remains stable inside each category.

## Edge cases

- Quantity zero: allowed by model but should be visually questioned; no generated assignments or Input List rows.
- Duplicate equipment: copy assignments with new IDs.
- Category deletion: preserve equipment through reassignment.
- Assignment edit after Input List manual edit: synchronization preview must preserve the manual row value and surface the source change.
