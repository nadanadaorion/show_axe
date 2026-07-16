import { expect, test } from '@playwright/test'
import { expectNoCriticalAccessibilityViolations } from '../e2e/accessibilityAssertions'

test('GitHub Pages subpath serves shell, assets, lazy public route, and an isolated Service Worker', async ({ page, context }) => {
  const badResponses: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === 'http://127.0.0.1:4174') badResponses.push(response.url())
  })

  await page.goto('/show_axe/')
  await expect(page.getByRole('heading', { name: 'Conectar Supabase' })).toBeVisible()
  await expectNoCriticalAccessibilityViolations(page)

  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready
    return { scope: ready.scope, scriptURL: ready.active?.scriptURL }
  })
  expect(registration.scope).toBe('http://127.0.0.1:4174/show_axe/')
  expect(registration.scriptURL).toMatch(/\/show_axe\/sw\.js\?v=2\.0\.0$/)

  // The first visit installs the worker after the page assets have already loaded. One online,
  // controlled reload is therefore required before the documented "subsequent use offline" case.
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(page.getByRole('heading', { name: 'Conectar Supabase' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('orion-shows-show_axe-v2.0.0')
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Conectar Supabase' })).toBeVisible()
  await context.setOffline(false)

  await page.addInitScript(() => {
    window.__ORION_CONFIG__ = {
      supabaseUrl: 'http://127.0.0.1:9',
      supabasePublishableKey: 'local-pages-placeholder-key-1234567890',
    }
  })
  await page.route('http://127.0.0.1:9/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }))
  // A query forces a new document so the runtime init script runs before config.js; changing only
  // the hash would be same-document navigation from the unconfigured Setup screen.
  await page.goto('/show_axe/?runtime=release-check#/public/release-check')
  await expect(page.getByText('Show no disponible')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Show no disponible')).toBeVisible()

  expect(badResponses).toEqual([])
})
