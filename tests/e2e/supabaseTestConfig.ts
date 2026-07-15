import type { Page } from '@playwright/test'

/**
 * Shared gate for the Supabase-backed E2E specs (tests/e2e/*.supabase.spec.ts).
 * Mirrors tests/integration/env.ts but for the browser-driven suite. See
 * .env.example for how to point SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY at a
 * local `supabase start` stack or a disposable test project.
 *
 * When SUPABASE_INTEGRATION_REQUIRED is set (the supabase-integration CI job
 * sets it), a missing config throws at spec-collection time instead of
 * silently skipping — see tests/integration/env.ts for why.
 */
export function getE2ESupabaseConfig(): { url: string; anonKey: string } | undefined {
  const url = process.env.SUPABASE_TEST_URL?.trim()
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY?.trim()
  if (url && anonKey) return { url, anonKey }
  if (process.env.SUPABASE_INTEGRATION_REQUIRED) {
    throw new Error(
      '[e2e] SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY are not set, but SUPABASE_INTEGRATION_REQUIRED is. See .env.example.',
    )
  }
  return undefined
}

/** Injects runtime config before the app boots, the same way public/config.js does in production. */
export async function configureSupabaseRuntime(page: Page, config: { url: string; anonKey: string }) {
  await page.addInitScript(
    ({ url, anonKey }) => {
      ;(window as unknown as { __ORION_CONFIG__: unknown }).__ORION_CONFIG__ = {
        supabaseUrl: url,
        supabasePublishableKey: anonKey,
      }
    },
    { url: config.url, anonKey: config.anonKey },
  )
}
