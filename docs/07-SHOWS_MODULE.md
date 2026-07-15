# Shows module

## Shows list

The main page separates:

- active Shows;
- archived Shows.

Each card displays, when available:

- name;
- date;
- time;
- Show type;
- people count;
- equipment readiness count and progress.

## Ordering

Active Shows with dates sort ascending by date. Undated active Shows follow dated Shows and sort by recent update. Archived Shows may sort by date descending or recent update, provided the behavior is stable and documented.

## Search

Search matches at least:

- Show name;
- Show type;
- date text.

## Create Show

Required:

- name.

Optional:

- date;
- time;
- type;
- start source.

Start source options:

- blank;
- active Preset;
- previous active Show.

After creation, navigate immediately to the Show workspace.

## Duplicate Show

Duplication copies all Show content, including Input List, but:

- creates a new Show ID;
- creates a new public slug;
- creates new IDs for categories, equipment, assignments, people, schedule items, Input List rows, and returns;
- remaps Input List provenance to the duplicated equipment and assignments;
- clears archived state;
- uses a name suffix indicating a copy.

## Archive and restore

Archive is non-destructive. The Show remains synchronized, retains its public slug, and remains visible through its public link.

## Delete and Undo

Deletion removes the Show from the editor and remote database. If Undo is offered, the implementation must define whether it restores the same public slug before the remote deletion becomes irreversible. A misleading Undo that creates a different public identity is not acceptable.

## Show header

The Show header includes:

- editable name;
- metadata badges;
- Share;
- Input List;
- Save as Preset;
- Apply Preset;
- Archive/Restore.

## Lock states

- Checking: show a neutral loading state.
- Owned: full edit access.
- Blocked: show device label and retry; no force unlock.
- Offline: permit editing with a clear offline notice.
- Waiting/error: permit local editing only when the application cannot establish lock state and explicitly explains the risk.
- Idle expiry: pause online editing and require reacquisition.
