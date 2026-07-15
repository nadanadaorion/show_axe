# Information and schedule

## Show information

Editable fields:

- date;
- time;
- Show type;
- general note.

These fields belong to the Show, not a separate live-linked entity.

## Schedule item

Fields:

- name;
- start time;
- optional end time;
- optional notes.

## Chronology

The displayed schedule is chronological by start time. Stable order breaks ties. If manual ordering is retained internally, chronological display remains the primary user-facing behavior unless a later decision changes it.

## Duration

- Calculate duration when start and end are valid.
- Handle crossing midnight only if explicitly supported and tested.
- Otherwise, show a validation message rather than a negative duration.

## Actions

- add;
- edit inline or in context;
- delete;
- move/reorder where supported.

## Empty state

Explain that schedules are optional and can represent load-in, soundcheck, doors, set time, curfew, transport, or other operational milestones.
