import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig } from './supabaseTestConfig'
import { expectCenterReceivesPointer } from './browserAssertions'

const config = getE2ESupabaseConfig()

test.describe('Equipment and Input List are usable on a mobile viewport (real Supabase)', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('8. Equipment: adding, reading, and moving an item works without horizontal page overflow', async ({ page }) => {
    await configureSupabaseRuntime(page, config!)
    await page.goto('/')
    await page.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Mobile Equipment ${Date.now()}`
    await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    const createButton = page.getByRole('button', { name: 'Crear y abrir' })
    await expectCenterReceivesPointer(createButton)
    await createButton.click()
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name)

    await page.getByRole('button', { name: 'Agregar equipo' }).click()
    await page.getByRole('button', { name: 'Creación libre' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('Consola digital')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByText(/Consola digital$/)).toBeVisible()

    await page.getByRole('button', { name: 'Agregar equipo' }).click()
    await page.getByRole('button', { name: 'Creación libre' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('Multicable')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByText(/Multicable$/)).toBeVisible()

    // The whole document must not need horizontal scrolling to use the Equipment tab.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)

    // Reorder via the accessible up/down controls (no drag gesture) and confirm it took effect.
    await page.getByRole('button', { name: 'Bajar Consola digital' }).click()
    await expect(page.getByText('Equipo movido')).toBeVisible()
    const rowOrder = await page.locator('[draggable] .truncate.text-sm.font-medium').allTextContents()
    expect(rowOrder[0]).toContain('Multicable')
    expect(rowOrder[1]).toContain('Consola digital')
  })

  test('9,10. Input List: rows are editable on mobile, including a custom channel number, without page overflow', async ({ page }) => {
    await configureSupabaseRuntime(page, config!)
    await page.goto('/')
    await page.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Mobile InputList ${Date.now()}`
    await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    const createButton = page.getByRole('button', { name: 'Crear y abrir' })
    await expectCenterReceivesPointer(createButton)
    await createButton.click()
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name)

    await page.getByRole('button', { name: 'Agregar equipo' }).click()
    await page.getByRole('button', { name: 'Creación libre' }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('SM58')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByText(/SM58$/)).toBeVisible()

    await page.getByRole('button', { name: 'Input list', exact: true }).click()
    const continueButton = page.getByRole('button', { name: 'Continuar' })
    if (await continueButton.isVisible().catch(() => false)) await continueButton.click()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)

    // The CH/Uso/Equipo/48V/Patch/Notas table is wider than the viewport by design (an adaptive
    // horizontal-scroll table, not squeezed columns); its own wrapper — not the page — scrolls.
    const chInput = page.getByLabel(/^Canal de/).first()
    await chInput.fill('42')
    await expect(chInput).toHaveValue('42')

    const notasInput = page.getByPlaceholder('Notas técnicas')
    await notasInput.scrollIntoViewIfNeeded()
    await notasInput.fill('Revisar antes del soundcheck')
    await expect(notasInput).toHaveValue('Revisar antes del soundcheck')
  })
})
