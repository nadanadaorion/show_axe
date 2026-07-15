# Business rules

## Show lifecycle

1. A Show can be created with only a name.
2. Creation opens the Show immediately.
3. A Show may start blank, from a Preset, or from a previous Show.
4. Duplicating a Show creates new internal IDs and a new public slug.
5. Archiving preserves all content and the public link.
6. Restoring returns an archived Show to the active list.
7. Deleting removes the shared Show and invalidates the public link.
8. Routine local deletion should offer Undo while the deletion is still recoverable.

## Snapshot isolation

1. Library entities are copied into Shows.
2. Preset contents are copied or merged into Shows.
3. Library edit, archive, or deletion never mutates existing Shows.
4. A Show can contain data not present in the Library.
5. `sourceLibraryId` is provenance only, not a live reference.

## Equipment

1. Equipment is grouped by line and quantity.
2. Quantity is a non-negative integer.
3. Per-unit uses do not split the grouped line.
4. Assignment count is normalized to quantity.
5. Reducing quantity removes excess assignments only after preserving the earliest existing assignments.
6. Increasing quantity creates blank assignments.
7. `includeInInputList` defaults to true for new equipment.
8. Equipment may be manually excluded from Input List generation.
9. Checked state contributes to category and overall readiness progress.
10. Reordering and category movement do not alter equipment identity or assignments.

## People

1. The same person appears at most once in a Show.
2. A person may have multiple roles, types, phones, and emails.
3. Company and notes are optional.
4. Library People are copied into the Show.

## Schedule

1. Start time is required for a schedule item.
2. End time is optional.
3. When both exist and are valid, duration is calculated automatically.
4. Display order is chronological unless the user is explicitly editing manual order behavior.
5. Invalid negative durations must not be silently presented as valid.

## Input List generation

1. Input List may be opened at any time.
2. When Equipment is incomplete and warnings are enabled, show a non-blocking warning.
3. The warning includes an option to disable future warnings.
4. The warning preference can be re-enabled in Preferences.
5. Initial generation creates one row per assignment of included equipment.
6. The assignment `use` populates row use.
7. Equipment name populates row equipment.
8. Blank assignment use is allowed; the generated row remains editable.
9. Generated rows retain provenance IDs.
10. Manual rows have no provenance IDs.

## Input List synchronization

1. Synchronization is user-triggered through `Update from Equipment`.
2. Show a preview before applying additions/removals/updates.
3. Preserve manually edited `use` and `equipment` values.
4. Preserve manual rows.
5. Preserve `channel`, phantom, patch, notes, and order for retained rows.
6. Add new generated rows after existing rows unless the user chooses another documented ordering rule.
7. Remove generated rows whose source assignment no longer exists, only after preview.
8. Synchronization never silently renumbers channels.

## Channel numbers

1. `CH` is editable per row.
2. Channels do not have to begin at 1.
3. Reordering rows does not change channels.
4. A `channelStart` control can renumber all rows consecutively when explicitly invoked.
5. New rows continue from the highest existing numeric channel when possible.
6. Non-numeric channel labels are permitted and ignored when calculating the next numeric channel.
7. PDF output uses the stored channel value exactly.

## Monitor returns

1. Inputs and returns appear in the same Input List surface.
2. A mono return occupies one output.
3. A stereo return occupies two consecutive outputs.
4. Output labels render as one number for mono and a range for stereo.
5. Changing stereo state must not silently collide with another return; collisions must be visible or validated.

## Public links

1. Every Show receives a permanent random slug at creation.
2. Public routes always show the latest synchronized Show data.
3. Archiving does not disable public access.
4. Deleting disables public access because the Show record no longer exists.
5. Public UI contains no mutation controls.

## Shared editing and locks

1. V2 has no accounts.
2. Any visitor to the editor URL can edit shared data.
3. Opening a Show online attempts to acquire its lock.
4. A lock identifies the editing device automatically, such as browser and operating system.
5. A different active lock blocks Show editing.
6. There is no force-unlock action.
7. The lock is released when leaving the Show when possible.
8. The lock expires after ten minutes without activity.
9. Offline Show editing remains allowed because lock state cannot be verified.

## Conflicts

1. A conflict occurs when a local pending Show mutation uses an obsolete remote revision or the remote Show was deleted.
2. The user must choose exactly one of:
   - keep local;
   - keep online.
3. There is no automatic duplicate option.
4. Choosing online discards the pending local mutation for that Show.
5. Choosing local retries against the latest remote revision.
6. Conflict resolution must be explicit and visible; never silently overwrite both versions.

## Backups and import

1. JSON export remains available even with Supabase.
2. Automatic local backups remain available.
3. V2 uses a new local database and does not automatically import V1 data.
4. Manual import must validate shape/version before mutation.
5. Replace and merge behaviors must be explicit.
