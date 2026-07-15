# ADR 0004 — HashRouter for GitHub Pages

Status: Accepted.

## Context

The application must deploy as static files under a GitHub Pages repository subpath without custom server rewrites.

## Decision

Use React Router `HashRouter` and Vite relative base paths.

## Consequences

- Reliable static hosting.
- URLs contain `#`.
- Public links use `#/public/:slug`.
