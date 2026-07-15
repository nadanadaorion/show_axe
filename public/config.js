// Ori♡n Shows V2 runtime configuration.
// Paste the values from Supabase > Project Settings > API / Connect.
// Use the publishable key (sb_publishable_...) or legacy anon key. Never use a secret/service-role key.
//
// Guarded with `||` (fill in only if unset) rather than a flat assignment so an environment that
// already provided window.__ORION_CONFIG__ before this script runs — e.g. Playwright's
// addInitScript in the Supabase-backed E2E specs — is not clobbered back to empty placeholders. In
// a normal deployment nothing sets __ORION_CONFIG__ earlier, so this behaves exactly as before.
window.__ORION_CONFIG__ = window.__ORION_CONFIG__ || {
  supabaseUrl: '',
  supabasePublishableKey: '',
}
