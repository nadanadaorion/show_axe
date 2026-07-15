# Ori♡n Shows

Ori♡n Shows is a web application for preparing live shows quickly, simply, and reliably. The Show is the primary entity and contains Equipment, People, Information, Schedule, Input List, and monitor returns. Reusable data lives in the Library and Presets, while each Show remains an independent snapshot.

This repository is both:

1. a real React/TypeScript application baseline; and
2. the source-of-truth documentation package for continued implementation with Codex or a human developer.

## Current version

Baseline: **V2.0.0 implementation candidate**.

The source currently compiles and passes lint. It still requires automated tests and an end-to-end validation against a real Supabase project before it should be treated as a production release.

## Start development

Requirements: Node.js 20+.

```bash
npm ci
npm run dev
```

Validation:

```bash
npm run lint
npm run build
```

## Configure Supabase

1. Create a Supabase project.
2. Run `supabase/SETUP.sql` in **SQL Editor**.
3. Copy `public/config.js` and set the Project URL and publishable key.
4. Never place a secret/service-role key in this repository.

```js
window.__ORION_CONFIG__ = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
}
```

## Documentation

Begin with:

- [`CODEX_START_HERE.md`](CODEX_START_HERE.md)
- [`AGENTS.md`](AGENTS.md)
- [`docs/README.md`](docs/README.md)
- [`docs/24-CURRENT_IMPLEMENTATION_AUDIT.md`](docs/24-CURRENT_IMPLEMENTATION_AUDIT.md)

## Deliberate access model

V2 has no accounts. Anyone who can open the editor URL can modify shared data. The public Show route is read-only in the interface, but it is not an authorization boundary because the editor URL remains publicly reachable. This is a documented product decision, not a secure multi-tenant design.
