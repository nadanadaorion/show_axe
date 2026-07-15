export interface OrionRuntimeConfig {
  supabaseUrl: string
  supabasePublishableKey: string
}

declare global {
  interface Window {
    __ORION_CONFIG__?: Partial<OrionRuntimeConfig>
  }
}

const STORAGE_KEY = 'orion-shows:v2-runtime-config'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getRuntimeConfig(): OrionRuntimeConfig {
  let local: Partial<OrionRuntimeConfig> = {}
  try {
    local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<OrionRuntimeConfig>
  } catch {
    local = {}
  }
  const file = window.__ORION_CONFIG__ || {}
  return {
    supabaseUrl: clean(file.supabaseUrl) || clean(local.supabaseUrl),
    supabasePublishableKey: clean(file.supabasePublishableKey) || clean(local.supabasePublishableKey),
  }
}

const PRODUCTION_SUPABASE_URL_PATTERN = /^https:\/\/.+\.supabase\.co\/?$/i
// The documented local dev/test workflow (docs/19-TESTING_STRATEGY.md) points this app at
// `supabase start`'s own local stack (typically http://127.0.0.1:54321); without this, the
// setup screen would never be satisfied by that documented, intended URL.
const LOCAL_DEV_SUPABASE_URL_PATTERN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i

export function isSupportedSupabaseUrl(url: string): boolean {
  return PRODUCTION_SUPABASE_URL_PATTERN.test(url) || LOCAL_DEV_SUPABASE_URL_PATTERN.test(url)
}

export function isRuntimeConfigured() {
  const config = getRuntimeConfig()
  return isSupportedSupabaseUrl(config.supabaseUrl) && config.supabasePublishableKey.length > 20
}

export function saveLocalRuntimeConfig(config: OrionRuntimeConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    supabaseUrl: config.supabaseUrl.trim().replace(/\/$/, ''),
    supabasePublishableKey: config.supabasePublishableKey.trim(),
  }))
}

export function clearLocalRuntimeConfig() {
  localStorage.removeItem(STORAGE_KEY)
}

export function runtimeConfigComesFromFile() {
  return Boolean(clean(window.__ORION_CONFIG__?.supabaseUrl) && clean(window.__ORION_CONFIG__?.supabasePublishableKey))
}
