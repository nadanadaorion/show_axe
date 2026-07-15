import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig } from './supabaseTestConfig'

const config = getE2ESupabaseConfig()

test.describe('Show lock blocks a second device (real Supabase)', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('9,11,13. opening a Show acquires the lock; a second device is blocked until release, then can acquire it', async ({ browser }) => {
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    await configureSupabaseRuntime(pageA, config!)
    await pageA.goto('/')
    await pageA.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Lock ${Date.now()}`
    await pageA.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    await pageA.getByRole('button', { name: 'Crear y abrir' }).click()
    await expect(pageA.getByLabel('Nombre del show')).toHaveValue(name)
    const showUrl = pageA.url()
    // Let the Show creation (and A's own lock acquisition against it) flush to Supabase before B
    // navigates — same convention as offline-conflict.supabase.spec.ts. Without this, B's first
    // lock-acquire attempt can race the remote row's existence: orion_acquire_show_lock returns
    // acquired=false with no owner_client_id for a show that doesn't exist yet (status 'waiting',
    // not 'blocked'), and on the very next retry B could end up acquiring the lock itself instead
    // of ever seeing A's lock — not a product bug, just an unaccounted-for sync-latency race.
    await pageA.waitForTimeout(1_500)

    // Device B opens the same Show while A's lock (device A) is active.
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    await configureSupabaseRuntime(pageB, config!)
    await pageB.goto(showUrl)

    await expect(pageB.getByRole('heading', { name: 'Show en edición' })).toBeVisible({ timeout: 15_000 })
    await expect(pageB.getByText('No existe una opción de forzar desbloqueo.')).toBeVisible()
    await expect(pageB.getByRole('button', { name: /guardar preset|compartir/i })).toHaveCount(0)

    // Closing device A's context unmounts the page, releasing the lock.
    await contextA.close()

    await pageB.getByRole('button', { name: 'Comprobar nuevamente' }).click()
    await expect(pageB.getByLabel('Nombre del show')).toHaveValue(name, { timeout: 15_000 })

    await contextB.close()
  })
})
