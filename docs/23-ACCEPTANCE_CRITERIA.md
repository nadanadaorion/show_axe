# Acceptance criteria

A production V2 release is accepted only when all critical items pass.

## Application shell

- [ ] Loads from GitHub Pages under a repository subpath.
- [ ] Shows a useful setup screen when Supabase runtime config is missing.
- [ ] Never exposes a black screen on uncaught runtime errors.
- [ ] Reopens offline after one successful online load.
- [ ] Shows update/recovery behavior for a new deployed Service Worker version.

## Shows

- [ ] Create with name only and open immediately.
- [ ] Create blank, from Preset, and from previous Show.
- [ ] Duplicate remaps all internal IDs and public slug.
- [ ] Search and active/archive views work.
- [ ] Archive preserves public link.
- [ ] Delete invalidates public link.
- [ ] Undo behavior is honest and tested.

## Equipment

- [ ] Add from Library and free creation.
- [ ] Category CRUD and movement work.
- [ ] Drag/drop and keyboard alternative work.
- [ ] Quantity normalizes assignments.
- [ ] Same model can contain distinct per-unit uses.
- [ ] Input List inclusion defaults on and can be disabled.
- [ ] Progress is correct overall and per category.
- [ ] Library edits never mutate Show equipment.

## People

- [ ] Add from Library and free creation.
- [ ] Multiple roles, types, phones, and emails persist.
- [ ] Duplicate prevention/override behavior is defined.
- [ ] Search and ordering work.
- [ ] Library edits never mutate Show people.

## Information and schedule

- [ ] Date, time, type, and note persist.
- [ ] Schedule CRUD works.
- [ ] Chronological display is correct.
- [ ] Duration is correct for supported time ranges.

## Input List

- [ ] Can open before Equipment reaches 100%.
- [ ] Warning can be dismissed permanently and re-enabled.
- [ ] Generates one row per included equipment assignment.
- [ ] Manual rows persist.
- [ ] CH is individually editable.
- [ ] Channels can start at any number.
- [ ] Reordering does not alter CH.
- [ ] Explicit renumber uses selected start.
- [ ] New rows continue from highest numeric CH.
- [ ] Update preview identifies add/remove/update.
- [ ] Manual edits and manual rows survive update.
- [ ] Phantom, patch, notes, and custom channels survive update.
- [ ] Returns support mono/stereo and correct output labels.
- [ ] Overlapping output behavior is clear.
- [ ] Portrait PDF is correct.
- [ ] Landscape PDF is correct.
- [ ] Multi-page PDF retains headers/page numbers and exact CH values.

## Library and Presets

- [ ] All Library sections support CRUD/search.
- [ ] Preset create/edit/duplicate/archive/apply work.
- [ ] Merge preserves existing Show content.
- [ ] Replace behavior for existing Input List is explicit and tested.
- [ ] Preset edits do not mutate earlier Shows.

## Backups and import

- [ ] JSON export is versioned and excludes secrets/sync internals.
- [ ] Invalid import is rejected safely.
- [ ] Merge and replace are deterministic.
- [ ] Automatic backups are capped and restorable.
- [ ] V1 is not automatically migrated.

## Synchronization

- [ ] Initial pull produces same data on two devices.
- [ ] Clean local changes reach Supabase.
- [ ] Realtime propagates changes.
- [ ] Periodic fallback works when Realtime disconnects.
- [ ] Offline changes queue and upload after reconnect.
- [ ] Revision conflicts never overwrite silently.
- [ ] Keep online discards pending local version.
- [ ] Keep local applies against latest revision.
- [ ] Remote deletion conflict works.
- [ ] Workspace concurrent-edit policy is explicit and tested.

## Locks

- [ ] Opening Show acquires lock online.
- [ ] Second device is blocked and sees automatic device label.
- [ ] No force-unlock action exists.
- [ ] Activity renews lock.
- [ ] Ten minutes inactivity releases/expires lock.
- [ ] Leaving Show releases lock when possible.
- [ ] Offline editing remains available with warning.

## Public view

- [ ] Permanent slug loads current remote Show.
- [ ] No editor mutation controls appear.
- [ ] Archived Show remains visible.
- [ ] Deleted Show returns not found.
- [ ] Internal IDs/revisions/lock details are not shown.

## Quality

- [ ] ESLint passes.
- [ ] TypeScript production build passes.
- [ ] Unit/component tests pass.
- [ ] Critical Playwright tests pass.
- [ ] Supabase verification passes.
- [ ] No secret keys are committed.
- [ ] Desktop and mobile smoke tests pass.

For Milestone 3 acceptance specifically, desktop and mobile must both execute in Chromium against the CI
Supabase stack with zero skips; focus restoration must pass after Escape and button closure, the mobile
Equipment reorder target must measure at least approximately 44×44 CSS px, and no passing test may depend
on retry. A failed run does not satisfy these boxes even when its build and integration jobs pass.
