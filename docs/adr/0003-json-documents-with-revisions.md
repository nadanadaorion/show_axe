# ADR 0003 — JSON documents with optimistic revisions

Status: Accepted for V2 baseline.

## Context

Shows contain nested snapshot data and must synchronize independently while preserving local-first behavior.

## Decision

Store one JSONB document per Show and one JSONB Workspace document. Guard writes with monotonically increasing revisions through RPC functions.

## Consequences

- Simple snapshot persistence and transport.
- Easy whole-Show conflict comparison.
- Limited field-level merge/query capability.
- Workspace document creates a larger conflict domain.
