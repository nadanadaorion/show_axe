import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig } from './supabaseTestConfig'

const config = getE2ESupabaseConfig()

test.describe('Desktop smoke test: Shows, Equipment, Input List, a modal, keyboard navigation (real Supabase)', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('Shows listing renders, a Show can be opened, Equipment/Input List are usable, a modal behaves accessibly, and keyboard-only navigation works', async ({ page }) => {
    await configureSupabaseRuntime(page, config!)

    // Shows listing.
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Shows' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nuevo show' })).toBeVisible()

    // Opening a Show.
    await page.getByRole('button', { name: 'Nuevo show' }).click()
    const name = `E2E Smoke ${Date.now()}`
    await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(name)
    await page.getByRole('button', { name: 'Crear y abrir' }).click()
    await expect(page.getByLabel('Nombre del show')).toHaveValue(name)

    // Equipment.
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

    // Input List.
    await page.getByRole('button', { name: 'Input list', exact: true }).click()
    const continueButton = page.getByRole('button', { name: 'Continuar' })
    if (await continueButton.isVisible().catch(() => false)) await continueButton.click()
    await expect(page.getByRole('heading', { name: 'Entradas' })).toBeVisible()
    await expect(page.getByText(/Consola digital$/)).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar input list' }).click()

    // A modal: accessible dialog role/name, Escape closes it (cancelable), and focus returns to the trigger.
    const trigger = page.getByRole('button', { name: 'Agregar equipo' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Agregar equipo' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // The header close button follows the same real-browser restoration path.
    await trigger.click()
    await page.getByRole('dialog', { name: 'Agregar equipo' }).getByRole('button', { name: 'Cerrar' }).click()
    await expect(page.getByRole('dialog', { name: 'Agregar equipo' })).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // Keyboard navigation: move the newly added equipment item up/down without a drag gesture.
    const upButton = page.getByRole('button', { name: 'Subir Consola digital' })
    await expect(upButton).toBeDisabled()
    const downButton = page.getByRole('button', { name: 'Bajar Consola digital' })
    await downButton.focus()
    await expect(downButton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Equipo movido')).toBeVisible()
  })
})
