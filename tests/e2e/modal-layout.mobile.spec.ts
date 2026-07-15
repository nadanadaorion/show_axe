import { expect, test } from '@playwright/test'

test('a mobile modal keeps its action footer separate from its scrollable content', async ({ page }) => {
  // A syntactically valid but unreachable local runtime lets the local-first editor render
  // without requiring Supabase. The modal interaction under test completes before background
  // synchronization and remains deterministic when developers run this spec offline.
  await page.addInitScript(() => {
    ;(window as unknown as { __ORION_CONFIG__: unknown }).__ORION_CONFIG__ = {
      supabaseUrl: 'http://127.0.0.1:9',
      supabasePublishableKey: 'local-e2e-placeholder-key-1234567890',
    }
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo show' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo show' })
  const form = dialog.locator('form')
  const submit = dialog.getByRole('button', { name: 'Crear y abrir' })

  await page.getByPlaceholder('Ej. TABU — Foro Indie Rocks').fill(`E2E Modal ${Date.now()}`)

  const formBox = await form.boundingBox()
  const submitBox = await submit.boundingBox()
  expect(formBox).not.toBeNull()
  expect(submitBox).not.toBeNull()
  expect(formBox!.y + formBox!.height).toBeLessThanOrEqual(submitBox!.y)

  await submit.click()
  await expect(dialog).toHaveCount(0)
})
