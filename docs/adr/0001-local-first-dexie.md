# ADR 0001 — Local-first state with Dexie

Status: Accepted.

## Context

The application must remain usable offline and feel immediate during production work.

## Decision

Use Zustand for in-memory state and Dexie/IndexedDB for durable local data, backups, sync revisions, and pending mutations. UI mutations commit locally before remote synchronization.

## Consequences

- Offline work is possible.
- Sync/conflict logic is required.
- Runtime schema migrations must be managed.
- Clearing browser site data can destroy unsynchronized work.
