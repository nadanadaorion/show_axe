import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __ORION_CONFIG__: unknown }).__ORION_CONFIG__ = {
      supabaseUrl: 'http://127.0.0.1:9',
      supabasePublishableKey: 'local-e2e-placeholder-key-1234567890',
    }
  })
})

test('Sonic Grunge desktop keeps Shows, workspace, Input List, Library, modal, focus and offline state usable', async ({ page, context }) => {
  await page.goto('/')
  const title = page.getByRole('heading', { name: 'Shows' })
  await expect(title).toBeVisible()

  const visualContract = await title.evaluate((element) => {
    const root = getComputedStyle(document.documentElement)
    const heading = getComputedStyle(element)
    return {
      accent: root.getPropertyValue('--accent').trim(),
      displayFont: heading.fontFamily,
      titleWeight: Number(heading.fontWeight),
      globalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  expect(visualContract.accent).toBe('#0029ff')
  expect(visualContract.displayFont).toContain('Anybody')
  expect(visualContract.titleWeight).toBeGreaterThanOrEqual(800)
  expect(visualContract.globalOverflow).toBe(0)

  const newShow = page.getByRole('button', { name: 'Nuevo show' })
  await newShow.focus()
  expect(await newShow.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('3px')
  await newShow.click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo show' })
  await expect(dialog).toBeVisible()
  const dialogStyle = await dialog.evaluate((element) => {
    const style = getComputedStyle(element)
    return { borderWidth: style.borderWidth, radius: parseFloat(style.borderRadius), shadow: style.boxShadow }
  })
  expect(dialogStyle.borderWidth).toBe('2px')
  expect(dialogStyle.radius).toBeLessThanOrEqual(4)
  expect(dialogStyle.shadow).not.toBe('none')

  const name = `Sonic Grunge Visual ${Date.now()}`
  await dialog.getByRole('textbox', { name: 'Nombre *' }).fill(name)
  await page.getByRole('button', { name: 'Crear y abrir' }).click()
  await expect(page.getByLabel('Nombre del show')).toHaveValue(name)
  const showUrl = page.url()

  await page.getByRole('button', { name: 'Agregar equipo' }).click()
  await page.getByRole('button', { name: /libre/i }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Consola Sonic')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByText(/Consola Sonic$/)).toBeVisible()

  await page.getByRole('button', { name: 'Input list', exact: true }).click()
  const continueButton = page.getByRole('button', { name: 'Continuar' })
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click()
  await expect(page.getByRole('heading', { name: 'Entradas' })).toBeVisible()
  await expect(page.getByText(/Consola Sonic$/)).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar input list' }).click()

  await page.getByRole('link', { name: 'Biblioteca' }).click()
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible()
  expect(await page.getByRole('heading', { name: 'Biblioteca' }).evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Anybody')

  await page.goto(showUrl)
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByText(/^Edici.n sin conexi.n$/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar equipo' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
})
