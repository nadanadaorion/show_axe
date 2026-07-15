import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig } from './supabaseTestConfig'

const config = getE2ESupabaseConfig()

test.describe('Workspace (Library/Presets/Preferences) conflicts are remote-wins (real Supabase)', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('D-214: a confirmed Workspace conflict after an offline edit discards the local change, applies the remote version, notifies the user, and never shows a version picker', async ({ browser }) => {
    const admin = createClient(config!.url, config!.anonKey)
    // Start from an empty Workspace so this test is independent of whatever earlier specs left behind.
    await admin.from('orion_workspace').delete().eq('id', 'main')

    const context = await browser.newContext()
    const page = await context.newPage()
    await configureSupabaseRuntime(page, config!)
    await page.goto('/#/settings')

    // First save establishes a clean baseline revision — no conflict yet. Selects here have no
    // accessible-name association (docs/24-CURRENT_IMPLEMENTATION_AUDIT.md flags this as a known
    // gap, in scope for the Milestone 3 accessibility audit, not this patch), so they are located
    // by an option they alone contain rather than a label.
    const appearanceSelect = page.locator('select:has(option[value="dark"])')
    const languageSelect = page.locator('select:has(option[value="en"])')
    await appearanceSelect.selectOption('dark')
    await expect(page.getByRole('main').getByText('Guardado en línea')).toBeVisible({ timeout: 20_000 })

    await context.setOffline(true)
    // A local edit queued while offline, against the revision-1 baseline above.
    await languageSelect.selectOption('en')
    await expect(page.getByRole('main').getByText(/sin conexión/i)).toBeVisible({ timeout: 10_000 })

    // A second device saves directly while A is offline, advancing the revision — a genuine,
    // confirmed revision conflict once A reconnects, not a simulated one.
    const { data: current } = await admin.from('orion_workspace').select('data,revision').eq('id', 'main').maybeSingle()
    const remoteData = current!.data as { preferences: Record<string, unknown> }
    await admin.rpc('orion_save_workspace', {
      p_data: { ...remoteData, preferences: { ...remoteData.preferences, language: 'es', theme: 'dark' } },
      p_expected_revision: current!.revision,
    })

    await context.setOffline(false)

    // 8. the remote-wins notification appears with the exact suggested text.
    await expect(page.getByText('Se conservaron los cambios en línea porque este espacio fue modificado desde otro dispositivo.')).toBeVisible({ timeout: 20_000 })

    // 10. no version-picker UI for the Workspace conflict — unlike the Show conflict modal
    // (which only ever renders when a Show conflict is open), nothing here offers a choice.
    await expect(page.getByText('Conflicto de edición offline')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Conservar versión en línea' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Conservar versión local' })).toHaveCount(0)

    // 3. the remote version won: Idioma still reflects the remote's 'es', not this device's
    // discarded local 'en' edit.
    await expect(languageSelect).toHaveValue('es')

    await context.close()
  })
})
