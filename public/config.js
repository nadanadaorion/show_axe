// Ori♡n Shows V2 runtime configuration.
// Paste the values from Supabase > Project Settings > API / Connect.
// Use the publishable key (sb_publishable_...) or legacy anon key. Never use a secret/service-role key.
//
// Guarded with `||` (fill in only if unset) rather than a flat assignment so an environment that
// already provided window.__ORION_CONFIG__ before this script runs — e.g. Playwright's
// addInitScript in the Supabase-backed E2E specs — is not clobbered back to empty placeholders. In
// a normal deployment nothing sets __ORION_CONFIG__ earlier, so this behaves exactly as before.
//
// White-label: to run this app for a different team, point supabaseUrl/supabasePublishableKey at
// that team's Supabase project and fill in the `branding` block below. Leave any branding field
// empty to keep the built-in default. Accent colors must be hex (e.g. "#0029ff"); other values are
// ignored. See docs/27-BRANDING_AND_WHITE_LABEL.md.
window.__ORION_CONFIG__ = window.__ORION_CONFIG__ || {
  supabaseUrl: '',
  supabasePublishableKey: '',
  branding: {
    name: '',
    tagline: '',
    accent: '',
    accentText: '',
  },
}
