import type { Page } from '@playwright/test'

/**
 * Boots the editor with no backend at all, for the design/layout specs that assert UI behaviour
 * rather than synchronisation.
 *
 * The Supabase URL is syntactically valid but unreachable, so the local-first editor renders while
 * every network call fails harmlessly. The trusted-device record puts the app in the offline grace
 * state (D-218), which is exactly the condition these specs want: fully usable, no session, no
 * network. Without it the auth gate would show the login screen, which cannot be completed without
 * a reachable Supabase.
 */
export async function useLocalOnlyEditor(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { __ORION_CONFIG__: unknown }).__ORION_CONFIG__ = {
      supabaseUrl: 'http://127.0.0.1:9',
      supabasePublishableKey: 'local-e2e-placeholder-key-1234567890',
    }
    localStorage.setItem(
      'orion-shows:v2-trusted-device',
      JSON.stringify({ userId: 'e2e-local-user', email: 'e2e@local', trustedAt: '2026-01-01T00:00:00.000Z' }),
    )
  })
}
