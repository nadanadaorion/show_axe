# Source of truth

## Priority order

When requirements appear to conflict, use this order:

1. Explicit decisions in `25-DECISION_LOG.md`.
2. Non-negotiable rules in `05-BUSINESS_RULES.md`.
3. Module specifications in `07` through `16`.
4. Domain definitions in `04-DOMAIN_MODEL.md`.
5. Technical architecture in `18-TECHNICAL_ARCHITECTURE.md`.
6. Existing implementation.
7. Backlog or speculative ideas.

The implementation must be changed when it conflicts with a higher-priority source. Documentation must be updated when a new explicit user decision changes behavior.

## Baseline source material

The product originated from two approved documents:

- Executive summary: purpose, philosophy, core modules, UX principles, V1 scope, and technology.
- Complete implementation flow: preparation, data model, base components, Shows, Equipment, People, Information, Library, Presets, Preferences, backups, optimization, testing, and release.

Later approved decisions add:

- equipment assignments per physical unit;
- generated and editable Input List;
- monitor returns;
- portrait and landscape PDF export;
- editable channel numbers;
- shared Supabase workspace without accounts;
- local-first offline editing;
- explicit conflict resolution;
- temporary Show locks;
- permanent public read-only links.

## Change control

A behavioral change must include:

1. an entry in `25-DECISION_LOG.md`;
2. updates to the affected module document;
3. updated acceptance criteria;
4. tests proving the new behavior;
5. migration notes when data compatibility changes.
