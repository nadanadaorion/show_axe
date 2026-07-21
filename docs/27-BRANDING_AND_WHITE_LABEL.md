# Branding and white-label

This app is white-label: the same codebase can run for more than one production team, each with its
own name, subtitle, accent color and Supabase project. Nothing about a team's identity is baked into
the JavaScript bundle — it all comes from the runtime `config.js`, so standing up a new team is a
configuration task, not a fork of the source.

## What is customizable

| Field | Where it shows | Default |
|---|---|---|
| `name` | Sidebar, setup screen, public page header/footer, browser tab title | `Ori♡n Shows` |
| `tagline` | Subtitle under the name in the sidebar | `Preparación de shows` |
| `accent` | Primary accent color (buttons, active nav, focus rings, links) — both light and dark themes | `#0029ff` |
| `accentText` | Text/icon color painted on top of the accent | `#ffffff` |

Every field is optional. Leaving a field empty keeps the built-in default, so a partially filled
branding block can never blank out the UI. Accent colors must be plain hex (`#rgb`, `#rrggbb` or
`#rrggbbaa`); any other value is ignored, which also prevents a pasted value from injecting CSS.

The implementation lives in `src/lib/branding.ts`. Colors are applied by overriding the `--accent`
and `--accent-text` CSS variables defined in `src/index.css`; the full palette (backgrounds, panels,
lines) stays fixed so contrast and accessibility remain guaranteed.

## Configure a running deployment

Edit `config.js` next to the built app (or `public/config.js` before building) and fill in the
`branding` block alongside the Supabase credentials:

```js
window.__ORION_CONFIG__ = window.__ORION_CONFIG__ || {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
  branding: {
    name: 'Sunset Live',
    tagline: 'Producción de escenario',
    accent: '#e0245e',
    accentText: '#ffffff',
  },
}
```

No rebuild is needed for a deployment that loads `config.js` at runtime — refresh the page and the
new identity is applied on first paint.

## Configure a GitHub Pages deployment

`.github/workflows/deploy-pages.yml` generates `config.js` at deploy time from Actions **variables**
(never secrets). In addition to `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, set any of these
optional variables (Settings → Secrets and variables → Actions → Variables):

- `BRAND_NAME`
- `BRAND_TAGLINE`
- `BRAND_ACCENT` (hex, e.g. `#e0245e`)
- `BRAND_ACCENT_TEXT` (hex, e.g. `#ffffff`)

`scripts/configure-pages-runtime.mjs` validates the accent colors and writes them into the generated
`config.js`. Unset variables fall back to the defaults.

## Clone the app for a brand-new team

A repeatable checklist to run this platform for another team on its own Supabase account:

1. **Repository.** Create a new repository from this codebase (fork, template, or a fresh copy).
   Optionally set a matching Vite base — see `docs/20-DEPLOYMENT_AND_OPERATIONS.md` — if it will be
   served from a repository subpath other than `/show_axe/`.
2. **Supabase project.** Create a new Supabase project for the team. In the SQL Editor run
   `supabase/SETUP.sql`, then `supabase/VERIFY.sql`. Copy the Project URL and the
   publishable/anon key (never a secret/service-role key — see `docs/17-SECURITY_AND_PRIVACY.md`).
3. **Branding + credentials.** Put the Supabase values and the `branding` block into `config.js`
   (runtime) or the Actions variables above (GitHub Pages).
4. **Optional icons.** Replace `public/favicon.svg`, `public/favicon.ico` and
   `public/apple-touch-icon.png` to match the team.
5. **Deploy and smoke test.** Build/deploy, open the app, confirm the name/subtitle/accent are the
   team's, create a show, open the public link, and reopen offline.

Because each team points at its own Supabase project, their data is fully isolated: no shared tables,
no shared editor URL. The original production deployment is unaffected by anything a new clone does.
