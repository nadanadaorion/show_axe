# ADR 0002 — Supabase shared workspace without accounts

Status: Accepted by product owner.

## Context

The product owner explicitly rejected accounts and wants anyone with access to edit.

## Decision

Use a Supabase project with anonymous open read/write policies for the editor data.

## Consequences

- Minimal access friction.
- No reliable person-level attribution or authorization.
- Editor URL must be treated as publicly mutable.
- Public read-only mode is not a security boundary.
- Backups and recovery are especially important.
