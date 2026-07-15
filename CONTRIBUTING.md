# Contributing

## Branching

Use a short-lived branch per task:

- `feat/<scope>`
- `fix/<scope>`
- `test/<scope>`
- `docs/<scope>`
- `chore/<scope>`

## Commit convention

Use Conventional Commits:

- `feat: add input-list channel range validation`
- `fix: preserve custom channel numbers during sync`
- `test: cover offline conflict resolution`
- `docs: record workspace conflict policy`

## Pull request requirements

Every pull request must include:

- requirement or issue addressed;
- behavioral summary;
- verification performed;
- screenshots for visible changes;
- data/schema migration notes;
- risk and rollback notes.

## Quality gates

```bash
npm ci
npm run lint
npm run test --if-present
npm run build
```

Never merge a database change without an idempotent migration and corresponding documentation update.
