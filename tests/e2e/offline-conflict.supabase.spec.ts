import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig } from './supabaseTestConfig'

const config = getE2ESupabaseConfig()

test.describe('Offline queue, reconnect, and conflict resolution (real Supabase)', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('14,15. offline edits queue locally and flush automatically on reconnect', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await configureSupabaseRuntime(page, config!)
    await page.goto('/')
    await page.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Offline ${Date.now()}`
    await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    await page.getByRole('button', { name: 'Crear y abrir' }).click()
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name)
    await page.waitForTimeout(1_500) // let the creation flush before going offline

    await context.setOffline(true)
    const edited = `${name} (offline edit)`
    await page.getByLabel('Nombre del show').fill(edited)
    await page.goto('/#/settings')
    await expect(page.getByText(/sin conexión/i)).toBeVisible({ timeout: 10_000 })

    await context.setOffline(false)
    await expect(page.getByText('Guardado en línea')).toBeVisible({ timeout: 20_000 })

    await context.close()
  })

  test('16,17. a stale offline edit conflicts with a remote change, and "keep local" retries it onto the latest revision', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await configureSupabaseRuntime(page, config!)
    await page.goto('/')
    await page.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Conflict ${Date.now()}`
    await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    await page.getByRole('button', { name: 'Crear y abrir' }).click()
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name)
    const showId = new URL(page.url()).hash.split('/').pop()!
    await page.waitForTimeout(1_500) // let the creation flush

    // Release device A's lock by leaving the Show before going offline, so the
    // "remote" writer below is not rejected as `locked` instead of `conflict`.
    await page.goto('/#/shows')
    await page.waitForTimeout(500)

    await context.setOffline(true)
    await page.goto(`/#/shows/${showId}`)
    const localEdit = `${name} (kept local)`
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name, { timeout: 10_000 })
    await page.getByLabel('Nombre del show').fill(localEdit)
    await page.waitForTimeout(500) // let the local mutation queue

    // A second, unrelated writer advances the remote revision while A is offline
    // and holds no lock, producing a genuine revision conflict (not `locked`).
    const admin = createClient(config!.url, config!.anonKey)
    const { data: current } = await admin.from('orion_shows').select('data,revision').eq('id', showId).maybeSingle()
    await admin.rpc('orion_save_show', {
      p_id: showId,
      p_public_slug: (current!.data as { publicSlug: string }).publicSlug,
      p_data: { ...(current!.data as object), name: 'Remote edit while A offline' },
      p_archived: false,
      p_expected_revision: current!.revision,
      p_client_id: 'client-conflict-writer',
    })

    await context.setOffline(false)
    await expect(page.getByText('Conflicto de edición offline')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Remote edit while A offline')).toBeVisible()

    await page.getByRole('button', { name: 'Conservar versión local' }).click()
    await expect(page.getByText('Conflicto de edición offline')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByLabel('Nombre del show')).toHaveValue(localEdit)

    const { data: final } = await admin.from('orion_shows').select('data').eq('id', showId).maybeSingle()
    expect((final?.data as { name?: string })?.name).toBe(localEdit)

    await context.close()
  })

  test('16,18. "keep online" discards the local edit and applies the remote version', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await configureSupabaseRuntime(page, config!)
    await page.goto('/')
    await page.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Conflict Online ${Date.now()}`
    await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    await page.getByRole('button', { name: 'Crear y abrir' }).click()
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name)
    const showId = new URL(page.url()).hash.split('/').pop()!
    await page.waitForTimeout(1_500)

    await page.goto('/#/shows')
    await page.waitForTimeout(500)

    await context.setOffline(true)
    await page.goto(`/#/shows/${showId}`)
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name, { timeout: 10_000 })
    await page.getByLabel('Nombre del show').fill(`${name} (discarded)`)
    await page.waitForTimeout(500)

    const admin = createClient(config!.url, config!.anonKey)
    const { data: current } = await admin.from('orion_shows').select('data,revision').eq('id', showId).maybeSingle()
    await admin.rpc('orion_save_show', {
      p_id: showId,
      p_public_slug: (current!.data as { publicSlug: string }).publicSlug,
      p_data: { ...(current!.data as object), name: 'Remote wins' },
      p_archived: false,
      p_expected_revision: current!.revision,
      p_client_id: 'client-conflict-writer',
    })

    await context.setOffline(false)
    await expect(page.getByText('Conflicto de edición offline')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Conservar versión en línea' }).click()
    await expect(page.getByText('Conflicto de edición offline')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByLabel('Nombre del show')).toHaveValue('Remote wins')

    await context.close()
  })
})
