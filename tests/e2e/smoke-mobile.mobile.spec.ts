import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig, performAndWaitForOnlineSave } from './supabaseTestConfig'
import { tapUnobstructedCenter } from './browserAssertions'

const config = getE2ESupabaseConfig()

test.describe('Mobile smoke test: Shows listing, opening a Show, a modal, keyboard navigation (real Supabase)', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('Shows listing, opening a Show, a modal, and keyboard-only reordering all work on a mobile viewport, without page-level horizontal overflow', async ({ page }) => {
    await configureSupabaseRuntime(page, config!)

    // Shows listing.
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Shows' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nuevo show' })).toBeVisible()
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)

    // Opening a Show.
    await page.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Mobile Smoke ${Date.now()}`
    await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    const createButton = page.getByRole('button', { name: 'Crear y abrir' })
    await performAndWaitForOnlineSave(page, () => tapUnobstructedCenter(page, createButton))
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name)

    await page.getByRole('button', { name: 'Agregar equipo' }).click()
    await page.getByRole('button', { name: 'Creación libre' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('Torre de bajos')
    await performAndWaitForOnlineSave(page, () => page.getByRole('button', { name: 'Agregar', exact: true }).click())
    await expect(page.getByText(/Torre de bajos$/)).toBeVisible()
    await page.getByRole('button', { name: 'Agregar equipo' }).click()
    await page.getByRole('button', { name: 'Creación libre' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('Subwoofer')
    await performAndWaitForOnlineSave(page, () => page.getByRole('button', { name: 'Agregar', exact: true }).click())
    await expect(page.getByText(/Subwoofer$/)).toBeVisible()

    const touchTarget = await page.getByRole('button', { name: 'Bajar Torre de bajos' }).boundingBox()
    expect(touchTarget?.width).toBeGreaterThanOrEqual(44)
    expect(touchTarget?.height).toBeGreaterThanOrEqual(44)

    // A modal on mobile: accessible, and Escape closes a cancelable one.
    const trigger = page.getByRole('button', { name: 'Agregar equipo' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Agregar equipo' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // Keyboard-only reordering (no drag gesture) on a mobile viewport.
    const downButton = page.getByRole('button', { name: 'Bajar Torre de bajos' })
    await downButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Equipo movido')).toBeVisible()

    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
  })
})
