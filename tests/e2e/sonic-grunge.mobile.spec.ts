import { expect, test } from '@playwright/test'
import { tapUnobstructedCenter } from './browserAssertions'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __ORION_CONFIG__: unknown }).__ORION_CONFIG__ = {
      supabaseUrl: 'http://127.0.0.1:9',
      supabasePublishableKey: 'local-e2e-placeholder-key-1234567890',
    }
  })
})

test('Sonic Grunge remains usable at 375x667 with internal technical scrolling and no global overflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Shows' })).toBeVisible()
  expect(await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ width: 375, overflow: 0 })

  await page.getByRole('button', { name: 'Nuevo show' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo show' })
  await expect(dialog).toBeVisible()
  const name = `Sonic Mobile ${Date.now()}`
  await dialog.getByRole('textbox', { name: 'Nombre *' }).fill(name)
  await tapUnobstructedCenter(page, page.getByRole('button', { name: 'Crear y abrir' }))
  await expect(page.getByLabel('Nombre del show')).toHaveValue(name)

  await page.getByRole('button', { name: 'Agregar equipo' }).click()
  await page.getByRole('button', { name: /libre/i }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Caja DI Sonic')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByText(/Caja DI Sonic$/)).toBeVisible()

  await page.getByRole('button', { name: 'Input list', exact: true }).click()
  const continueButton = page.getByRole('button', { name: 'Continuar' })
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click()
  await expect(page.getByRole('heading', { name: 'Entradas' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
  const technicalScroller = page.locator('.overflow-x-auto').filter({ has: page.getByText('CH', { exact: true }) })
  await expect(technicalScroller).toBeVisible()
  expect(await technicalScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)

  const close = page.getByRole('button', { name: 'Cerrar input list' })
  const target = await close.boundingBox()
  expect(target?.width).toBeGreaterThanOrEqual(44)
  expect(target?.height).toBeGreaterThanOrEqual(44)
})
