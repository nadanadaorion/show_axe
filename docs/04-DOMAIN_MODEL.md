# Domain model

This document defines canonical domain semantics. TypeScript interfaces may be refactored, but behavior and meaning must remain compatible.

## Identifiers and timestamps

- Every entity uses a string ID generated client-side.
- Stored timestamps use ISO 8601 strings.
- A Show has a stable `publicSlug` for its public route.
- Internal copied entities receive new IDs when a Show or Preset is duplicated.

## Show

| Field | Meaning |
|---|---|
| `id` | Stable internal ID. |
| `publicSlug` | Permanent public-route identifier while the Show exists. |
| `name` | Required human-readable name. |
| `date` | Optional ISO calendar date. |
| `time` | Optional local time. |
| `showType` | Optional free-form type. |
| `note` | Optional general note. |
| `archived` | Removes Show from active list without deleting it. |
| `equipmentCategories` | Snapshot categories used by this Show. |
| `equipment` | Snapshot equipment lines. |
| `people` | Snapshot people. |
| `schedule` | Show schedule items. |
| `inputList` | Optional saved Input List configuration. |
| `createdAt` | Creation time. |
| `updatedAt` | Last local content mutation time. |

## ShowEquipmentCategory

- `id`
- `name`
- `order`

Categories are Show-local snapshots. Moving or renaming a Library category does not affect them.

## ShowEquipmentItem

| Field | Meaning |
|---|---|
| `sourceLibraryId` | Optional trace to copied Library item; not a live relationship. |
| `categoryId` | Show-local category. |
| `name` | Equipment label/model. |
| `quantity` | Number of grouped physical units. Integer, zero or greater. |
| `unit` | Optional unit label. |
| `originName` | Optional source/provider label copied into Show. |
| `notes` | General notes for the grouped line. |
| `checked` | Prepared/complete state. |
| `order` | Order within category. |
| `includeInInputList` | Whether assignments generate Input List rows; default true. |
| `assignments` | One assignment per physical unit, each with free-form use. |

## EquipmentAssignment

- `id`: stable within the Show Equipment line.
- `use`: free-form technical use, for example `Snare Up`, `Voz principal`, `OH L`.

The number of assignments must be normalized to the equipment quantity.

## ShowPerson

- unique once per Show;
- optional `sourceLibraryId` trace;
- `name`, `company`, `notes`;
- arrays for type names, role names, phones, and emails;
- `order`.

## ScheduleItem

- `name`;
- required `startTime`;
- optional `endTime`;
- optional `notes`;
- `order` for stable manual intent, while display is chronological where specified.

## InputListConfig

- `rows`;
- `channelStart`;
- `returns`;
- optional `generalNotes`;
- creation/update timestamps;
- optional `lastSyncedAt` indicating last reconciliation with Equipment.

## InputListRow

| Field | Meaning |
|---|---|
| `channel` | User-controlled string. Numeric values are common but not mandatory. |
| `use` | Source/use label. |
| `equipment` | Microphone, DI, line source, or other equipment. |
| `phantom` | Phantom-power flag. |
| `patch` | Optional patch/stagebox/input notation. |
| `notes` | Technical notes. |
| `sourceEquipmentId` | Optional generated-row provenance. |
| `sourceAssignmentId` | Optional assignment provenance. |
| `sourceEquipmentName` | Last generated equipment value for edit-preservation comparison. |
| `sourceUse` | Last generated use value for edit-preservation comparison. |
| `order` | Display order independent of `channel`. |

Rows without provenance are manual rows.

## MonitorReturn

- `destination`: performer/location;
- `system`: wedge, IEM, sidefill, drum fill, or free text;
- `stereo`: boolean;
- `outputStart`: positive output number;
- `notes`;
- `order`.

A stereo return occupies `outputStart` and `outputStart + 1`.

## Library

Contains:

- Equipment Library items;
- People Library items;
- Categories;
- Roles/functions;
- Person types;
- Origins.

Library relationships are optional and must not prevent free creation in Shows.

## Preset

A reusable partial Show snapshot containing:

- Show type and note;
- equipment categories;
- equipment;
- people;
- schedule.

A Preset does not include a public slug or active Show identity.

## Preferences

- date format;
- time format;
- language setting;
- initial module;
- theme;
- whether incomplete-equipment Input List warnings are shown.

## Synchronization records

Local persistence additionally stores:

- remote revision per entity;
- pending mutation queue;
- automatic backups;
- client/device identity.
