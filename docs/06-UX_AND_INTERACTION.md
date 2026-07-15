# UX and interaction specification

## Interaction tone

The interface should feel operational, calm, and direct. It is a production tool, not a dashboard for analytics or a decorative marketing surface.

## Layout

- Persistent sidebar on desktop.
- Compact/mobile navigation on small screens.
- Main content width supports dense technical tables without forcing unnecessary full-page navigation.
- Show header keeps primary actions visible: Share, Input List, Preset actions, Archive.

## Forms

- Inline edit where context is obvious.
- Expandable equipment/person rows for secondary fields.
- Labels remain visible; placeholders are not substitutes for labels.
- Required fields are minimal.
- Free-form creation is always available where catalogs are optional.

## Destructive actions

- Routine delete: perform immediately and show Toast with Undo.
- Permanent remote deletion may use a stronger confirmation if Undo cannot reliably reverse synchronization.
- Never use repeated confirmation dialogs for ordinary editing.

## Feedback states

Every asynchronous or data-dependent surface must support:

- loading;
- empty;
- success/settled;
- offline;
- synchronizing;
- conflict;
- error;
- blocked by another device.

A runtime error must render a recovery surface, never a black screen.

## Search

Search is immediate and local. It should match names and the most relevant visible metadata. Search must not mutate ordering.

## Drag and drop

- Equipment can move between categories.
- Reordering must have a keyboard-accessible alternative, such as Move up/Move down.
- Dragging must not alter IDs, assignments, checked state, or Input List provenance.

## Input List modal

- Large enough for technical tables.
- Inputs first, returns below on the same surface.
- Horizontal scrolling is acceptable on narrow screens, but key actions remain reachable.
- Manual edits save continuously or through a clear save mechanism; closing must not discard silently.
- Synchronization preview is separate from the live table.
- PDF orientation can be selected at export time.

## Warnings

Input List incomplete-equipment warning:

- explains the number of pending equipment lines;
- allows continuing;
- offers `Do not show again`;
- does not block future access after the user continues.

## Keyboard and accessibility

- All buttons have accessible names.
- Modal focus is trapped and returns to the trigger on close.
- Escape closes non-destructive modals.
- Form controls have associated labels.
- Status is not communicated by color alone.
- Minimum touch target: approximately 44 × 44 CSS pixels for primary mobile controls.
- Use semantic tables for exported/onscreen tabular data where practical.

## Responsive priorities

1. Preserve ability to create/open a Show.
2. Preserve Equipment check and assignment editing.
3. Preserve Input List edit/export.
4. Allow horizontal table scrolling rather than hiding technical columns.
5. Avoid hover-only controls.
