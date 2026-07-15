# ADR 0005 — Show locks instead of live co-editing

Status: Accepted.

## Context

The user wants shared access but not simultaneous real-time collaboration complexity.

## Decision

Use a temporary server lock per Show. Block a second online device, expire after ten minutes of inactivity, allow no force unlock, and permit offline editing with later conflict resolution.

## Consequences

- Simpler mental model than field-level live collaboration.
- Offline edits can still conflict.
- Stale locks require expiry and reliable heartbeat/release logic.
