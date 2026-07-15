# Synchronization, offline behavior, conflicts, and locks

## Local-first model

The UI always reads from local state backed by IndexedDB. Mutations:

1. update Zustand state immediately;
2. persist a local snapshot;
3. enqueue a compact pending mutation;
4. attempt synchronization when online.

This keeps editing responsive and available offline.

## Shared units

- Each Show is synchronized independently.
- Library, Presets, and Preferences are synchronized as one Workspace document in the baseline.

## Revisions

Supabase rows carry monotonically increasing revisions. A client mutation includes the revision it expects. The server applies it only when the stored revision matches.

## Initial synchronization

When online:

1. fetch remote Shows and Workspace;
2. apply remote entities that have no local pending mutation;
3. remove clean local Shows that were deleted remotely;
4. create Workspace remotely if missing;
5. process pending mutations;
6. update local sync records and status.

## Pending queue

At most one coalesced pending mutation exists per Show and one for Workspace. A newer local edit replaces the queued payload but retains the original expected revision until synchronization succeeds or conflict resolution changes it.

## Realtime

Realtime events reduce latency but are not the only synchronization mechanism. A periodic full sync remains active as fallback.

## Offline behavior

- After first successful load, the application shell opens offline through the Service Worker.
- Local IndexedDB data remains editable.
- Mutations queue locally.
- Show locks cannot be verified offline; show a clear risk notice.
- Reconnection triggers synchronization.

## Show conflicts

A Show conflict occurs when:

- remote revision differs from expected revision;
- remote Show was deleted after local client last synchronized.

Conflict UI displays enough context to identify local and online versions and offers only:

- Keep online.
- Keep local.

### Keep online

- delete the pending Show mutation;
- apply the latest remote Show or remote deletion locally;
- update sync record;
- close the conflict.

### Keep local

- retry local upsert/delete using the latest remote revision;
- if blocked by another device, wait and retry later rather than bypassing lock;
- on success, apply returned remote row and clear pending mutation.

## Workspace conflicts

Per D-214 (`docs/25-DECISION_LOG.md`), Workspace (Library/Presets/Preferences) conflicts are **remote-wins**:

- A Workspace conflict occurs the same way a Show conflict does: the remote revision differs from the
  revision the pending local mutation expected.
- On a confirmed conflict, discard the conflicting local Workspace mutation and apply the latest remote
  Workspace locally — the remote version is the source of truth.
- Show a clear notification that the online version was kept because a newer change existed from another
  device.
- There is no comparison dialog and no choice between local/online for Workspace conflicts (unlike Show
  conflicts, which still offer Keep online/Keep local per D-210).
- Never keep a duplicate or parallel copy of the discarded local Workspace change.
- This applies only when a conflict is actually detected (revision mismatch). Ordinary, non-conflicting
  local Workspace edits continue to sync normally and are never discarded.

This replaces the previous local-last retry policy (which resubmitted the local Workspace over the latest
remote revision, silently overwriting concurrent remote changes).

## Lock protocol

### Acquisition

When opening a Show online, call the lock RPC with:

- Show ID;
- client ID;
- automatic device label;
- inactivity duration.

### Ownership

A lock can be renewed by its current client. Another active client cannot replace it.

### Heartbeat

- Activity events update local last-activity time.
- Heartbeat attempts occur approximately every 30 seconds.
- Server expiry represents the remaining duration before ten minutes of inactivity.

### Release

- Release when navigating away/unmounting.
- Use a keepalive request on page hide when possible.
- If release fails, server expiry is the recovery path.

### Blocked behavior

- Show owner label.
- Retry action.
- No force unlock.
- No mutation controls while definitively blocked.

## Sync status

Visible statuses:

- unconfigured;
- connecting;
- synchronized;
- synchronizing with pending count;
- offline;
- conflict;
- error.
