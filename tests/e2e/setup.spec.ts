import { expect, test } from '@playwright/test'

/**
 * public/config.js ships with empty Supabase credentials, so a freshly built
 * app deterministically renders the Setup screen instead of the editor.
 * This is the smallest possible end-to-end smoke test: it proves the
 * Playwright + build + preview pipeline works end-to-end.
 */
// The Setup form's <Label> elements are not yet programmatically associated with their
// <Input> (no htmlFor/id pairing), so these locate fields by placeholder rather than
// accessible name. See docs/24-CURRENT_IMPLEMENTATION_AUDIT.md accessibility risk notes.
test('shows the Supabase setup screen when runtime config is empty', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Conectar Supabase' })).toBeVisible()
  await expect(page.getByPlaceholder('https://tu-proyecto.supabase.co')).toBeVisible()
  await expect(page.getByPlaceholder('sb_publishable_…')).toBeVisible()
})

test('rejects an invalid Supabase URL with an inline error', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('https://tu-proyecto.supabase.co').fill('not-a-url')
  await page.getByPlaceholder('sb_publishable_…').fill('sb_publishable_1234567890123456')
  await page.getByRole('button', { name: /guardar y abrir/i }).click()
  await expect(page.getByText('Escribe una URL válida de proyecto Supabase.')).toBeVisible()
})
