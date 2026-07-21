import { readFile, writeFile } from 'node:fs/promises'

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim()

if (!/^https:\/\/.+\.supabase\.co$/i.test(url)) throw new Error('SUPABASE_URL must be a Supabase project URL')
if (key.length < 20 || /service[_-]?role|sb_secret_/i.test(key)) throw new Error('SUPABASE_PUBLISHABLE_KEY must be a publishable/anon key, never a secret key')

// Optional white-label branding, injected from public GitHub Actions variables. Everything here is
// optional: an empty value keeps the app's built-in default (see src/lib/branding.ts). Accent
// colors must be plain hex so a misconfigured variable can never inject CSS at runtime.
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const brandAccent = (process.env.BRAND_ACCENT || '').trim()
const brandAccentText = (process.env.BRAND_ACCENT_TEXT || '').trim()

if (brandAccent && !HEX_COLOR.test(brandAccent)) throw new Error('BRAND_ACCENT must be a hex color, e.g. #0029ff')
if (brandAccentText && !HEX_COLOR.test(brandAccentText)) throw new Error('BRAND_ACCENT_TEXT must be a hex color, e.g. #ffffff')

const branding = {
  name: (process.env.BRAND_NAME || '').trim(),
  tagline: (process.env.BRAND_TAGLINE || '').trim(),
  accent: brandAccent,
  accentText: brandAccentText,
}

const target = new URL('../dist/config.js', import.meta.url)
await readFile(target, 'utf8')
await writeFile(
  target,
  `// Generated at deploy time from public GitHub Actions variables.\nwindow.__ORION_CONFIG__ = {\n  supabaseUrl: ${JSON.stringify(url)},\n  supabasePublishableKey: ${JSON.stringify(key)},\n  branding: ${JSON.stringify(branding)},\n}\n`,
)
