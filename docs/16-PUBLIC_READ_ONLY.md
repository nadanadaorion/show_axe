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

## Data access (D-219)

The route reads through `orion_public_show(slug)`, a `security definer` accessor returning at most
the one Show whose `public_slug` matches exactly. It is the only function anonymous visitors may
execute.

This replaced an anonymous `select` over `orion_shows`, under which the link restricted nothing at
data level: anyone holding the publishable key could enumerate every Show, archived ones included.

Realtime enforces the same policies, so this route no longer subscribes to live changes. It reloads
when the tab regains visibility or focus, and offers an explicit refresh control. That is adequate
for a page consulted a few times during a load-in, and it leaves no anonymous access to the table.

## Privacy warning

A public link is an unguessable capability, not an identity check. Anyone holding the URL can read
that Show, and the page must therefore never expose anything not intended for everyone in the venue.
It remains a read-only *view*: it is scoped to one Show, but it does not authenticate its visitor.
