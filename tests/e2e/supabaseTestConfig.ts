import { expect, type Page } from '@playwright/test'

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
export interface E2ESupabaseConfig {
  url: string
  anonKey: string
  /** Credentials of the authorised test account. Absent while a project still allows anonymous access. */
  email?: string
  password?: string
}

export function getE2ESupabaseConfig(): E2ESupabaseConfig | undefined {
  const url = process.env.SUPABASE_TEST_URL?.trim()
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY?.trim()
  if (url && anonKey) {
    return {
      url,
      anonKey,
      email: process.env.SUPABASE_TEST_EMAIL?.trim() || undefined,
      password: process.env.SUPABASE_TEST_PASSWORD?.trim() || undefined,
    }
  }
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

/**
 * Navigates to the editor and signs in if the login screen is shown (D-215).
 *
 * Written to work in both directions of the staged migration: while the project still allows
 * anonymous access no login screen appears and this is just a navigation, and once access is
 * revoked the same call signs in. Specs therefore do not need to know which phase the project is in.
 *
 * The session is stored by supabase-js in the context's localStorage, so later `page.goto` calls
 * within the same context stay signed in and need no further handling.
 */
export async function openEditor(page: Page, config: E2ESupabaseConfig, path = '/') {
  await page.goto(path)

  const loginHeading = page.getByRole('heading', { name: 'Iniciar sesión' })
  const appSidebar = page.getByRole('complementary')

  // The gate renders a "checking" state first, so neither view is present immediately. Wait for
  // whichever one settles rather than assuming.
  await expect(async () => {
    const settled = (await loginHeading.isVisible()) || (await appSidebar.isVisible())
    expect(settled).toBe(true)
  }).toPass({ timeout: 30_000 })

  if (!(await loginHeading.isVisible())) return

  if (!config.email || !config.password) {
    throw new Error(
      '[e2e] The app is asking for a login but SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD are not set. See .env.example.',
    )
  }

  await page.getByLabel('Email').fill(config.email)
  await page.getByLabel('Contraseña').fill(config.password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(loginHeading).toBeHidden({ timeout: 30_000 })
}

/** Starts observing before an action, then waits for its complete visible online-save cycle. */
export async function performAndWaitForOnlineSave(page: Page, action: () => Promise<unknown>) {
  // Establish a settled baseline so a still-finishing initial/previous cycle cannot be
  // mistaken for the save triggered by this action.
  await expect(page.getByRole('complementary').getByText('Guardado en línea')).toBeVisible({ timeout: 20_000 })

  await page.evaluate(() => {
    const sidebar = document.querySelector('aside')
    if (!sidebar) throw new Error('Sync sidebar was not found')

    const marker = { sawSyncing: false, completed: false }
    ;(
      window as unknown as {
        __orionObservedSyncCycle: typeof marker
      }
    ).__orionObservedSyncCycle = marker

    const observer = new MutationObserver(() => {
      const text = sidebar.textContent ?? ''
      if (text.includes('Sincronizando')) marker.sawSyncing = true
      if (marker.sawSyncing && text.includes('Guardado en línea')) {
        marker.completed = true
        observer.disconnect()
      }
    })
    observer.observe(sidebar, { childList: true, subtree: true, characterData: true })
  })

  await action()
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __orionObservedSyncCycle?: { completed: boolean }
              }
            ).__orionObservedSyncCycle?.completed ?? false,
        ),
      { timeout: 20_000, message: 'the online save cycle to reach Guardado en línea' },
    )
    .toBe(true)
  await expect(page.getByRole('complementary').getByText('Guardado en línea')).toBeVisible()
}
