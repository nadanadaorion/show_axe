import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The login screen (D-215) with a configured but unreachable Supabase and no trusted device — the
 * state a first-time visitor lands in. Needs no backend: resolving "no session" reads local storage
 * and never hits the network, so this runs in every environment.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __ORION_CONFIG__: unknown }).__ORION_CONFIG__ = {
      supabaseUrl: 'http://127.0.0.1:9',
      supabasePublishableKey: 'local-e2e-placeholder-key-1234567890',
    }
  })
})

test('an unauthenticated visitor gets the login screen instead of the editor', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  // The editor must not be reachable behind it, in any form.
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Nuevo show' })).toHaveCount(0)

  // D-217: no signup affordance, because signups are disabled and membership is granted by an
  // operator. Offering one would only create accounts that authenticate and are then denied.
  await expect(page.getByRole('button', { name: /crear cuenta|registr/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /crear cuenta|registr/i })).toHaveCount(0)
})

test('a deep link to an editor route does not bypass the login screen', async ({ page }) => {
  await page.goto('/#/shows')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})

test('the form is labelled, keyboard reachable and free of axe violations', async ({ page }) => {
  await page.goto('/')

  const email = page.getByLabel('Email')
  const password = page.getByLabel('Contraseña')
  await expect(email).toBeVisible()
  await expect(password).toHaveAttribute('type', 'password')

  await email.focus()
  await page.keyboard.press('Tab')
  await expect(password).toBeFocused()

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
})

test('submitting an empty form reports it inline rather than calling the server', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toHaveText('Escribe tu email y tu contraseña.')
})

test('the button is disabled offline, where signing in cannot succeed', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled()

  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))

  await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  await expect(page.getByText(/Iniciar sesión requiere internet/)).toBeVisible()

  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled()
})
