// Branding / white-label layer.
//
// Everything a new team needs to make this deployment look like *their* app — name, subtitle and
// accent color — is read here from the same runtime `public/config.js` that already carries the
// Supabase credentials (see src/lib/config.ts and docs/27-BRANDING_AND_WHITE_LABEL.md). Nothing is
// baked into the bundle, so cloning the app for another team is a config edit, not a code change.

export interface OrionBranding {
  /** App name shown in the sidebar, setup screen, public page and the browser tab title. */
  name: string
  /** Short subtitle shown under the name in the sidebar. */
  tagline: string
  /** Primary accent color. Any CSS hex color (#rgb / #rrggbb / #rrggbbaa). Empty keeps the default. */
  accent: string
  /** Text color painted on top of the accent (e.g. the active navigation item). Empty keeps the default. */
  accentText: string
}

// The identity of the original production deployment. A team that configures nothing keeps exactly
// the app that shipped, so an unconfigured/forgotten branding block can never blank out the UI.
export const DEFAULT_BRANDING: OrionBranding = {
  name: 'Ori♡n Shows',
  tagline: 'Preparación de shows',
  accent: '',
  accentText: '',
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// Only plain hex colors are accepted so a value pasted into config.js can never inject arbitrary
// CSS into the :root style declaration applyBranding() writes below.
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function safeColor(value: unknown): string {
  const candidate = clean(value)
  return HEX_COLOR.test(candidate) ? candidate : ''
}

export function getBranding(): OrionBranding {
  const configured = (typeof window === 'undefined' ? undefined : window.__ORION_CONFIG__?.branding) ?? {}
  return {
    name: clean(configured.name) || DEFAULT_BRANDING.name,
    tagline: clean(configured.tagline) || DEFAULT_BRANDING.tagline,
    accent: safeColor(configured.accent),
    accentText: safeColor(configured.accentText),
  }
}

// Resolved once at module load: config.js is injected before the bundle runs and never changes
// afterwards, so every component can import this constant instead of recomputing it.
export const branding = getBranding()

/**
 * Apply the resolved branding to the live document: browser tab title and the accent CSS variables.
 * Called once from main.tsx before React renders, so the first paint already carries the team's
 * identity. Inline styles on <html> override the :root/html.dark rules in index.css for both themes.
 */
export function applyBranding(active: OrionBranding = branding): void {
  if (typeof document === 'undefined') return
  document.title = active.name
  const root = document.documentElement
  if (active.accent) root.style.setProperty('--accent', active.accent)
  if (active.accentText) root.style.setProperty('--accent-text', active.accentText)
}
