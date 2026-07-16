import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { configureSupabaseRuntime, getE2ESupabaseConfig } from './supabaseTestConfig'

const config = getE2ESupabaseConfig()

test.describe('Realtime Show revisions remain monotonic in a second browser client', () => {
  test.skip(!config, 'SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY not set — see .env.example')

  test('rapid create, Equipment, and Input List revisions never restore the empty revision', async ({ page }) => {
    await configureSupabaseRuntime(page, config!)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Shows' })).toBeVisible()
    await expect(page.getByRole('complementary').getByText('Guardado en línea')).toBeVisible({ timeout: 20_000 })

    const admin = createClient(config!.url, config!.anonKey)
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const probeId = `e2e-realtime-probe-${suffix}`
    const probeSlug = `e2e-realtime-probe-slug-${suffix}`
    const showId = `e2e-realtime-show-${suffix}`
    const publicSlug = `e2e-realtime-slug-${suffix}`
    const name = `E2E Monotonic Realtime ${suffix}`
    const timestamp = '2026-01-01T00:00:00.000Z'
    const category = { id: `category-${suffix}`, name: 'Audio', order: 0 }
    const equipment = {
      id: `equipment-${suffix}`,
      categoryId: category.id,
      name: 'Revision-safe console',
      quantity: 1,
      checked: false,
      order: 0,
      includeInInputList: true,
      assignments: [{ id: `assignment-${suffix}`, use: 'FOH' }],
    }
    const base = {
      id: showId,
      publicSlug,
      name,
      archived: false,
      equipmentCategories: [category],
      equipment: [],
      people: [],
      schedule: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    try {
      // A visible probe proves this browser's real app subscription is active before the target
      // Show is created; no internal Zustand event or synthetic Realtime payload is used.
      const probe = await admin.rpc('orion_save_show', {
        p_id: probeId,
        p_public_slug: probeSlug,
        p_data: { ...base, id: probeId, publicSlug: probeSlug, name: `Subscription probe ${suffix}` },
        p_archived: false,
        p_expected_revision: 0,
        p_client_id: 'e2e-monotonic-writer',
      })
      expect(probe.error).toBeNull()
      await expect(page.getByRole('button', { name: `Abrir Subscription probe ${suffix}` })).toBeVisible({ timeout: 20_000 })

      const created = await admin.rpc('orion_save_show', {
        p_id: showId,
        p_public_slug: publicSlug,
        p_data: base,
        p_archived: false,
        p_expected_revision: 0,
        p_client_id: 'e2e-monotonic-writer',
      })
      expect(created.error).toBeNull()
      expect(created.data[0].revision).toBe(1)

      const withEquipment = { ...base, equipment: [equipment] }
      const updated = await admin.rpc('orion_save_show', {
        p_id: showId,
        p_public_slug: publicSlug,
        p_data: withEquipment,
        p_archived: false,
        p_expected_revision: 1,
        p_client_id: 'e2e-monotonic-writer',
      })
      expect(updated.error).toBeNull()
      expect(updated.data[0].revision).toBe(2)

      const withInputList = {
        ...withEquipment,
        inputList: {
          rows: [{
            id: `row-${suffix}`,
            order: 0,
            channel: '1',
            use: 'FOH',
            equipment: equipment.name,
            phantom: false,
            sourceEquipmentId: equipment.id,
            sourceAssignmentId: equipment.assignments[0].id,
            sourceEquipmentName: equipment.name,
            sourceUse: 'FOH',
          }],
          channelStart: 1,
          returns: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      }
      const finalWrite = await admin.rpc('orion_save_show', {
        p_id: showId,
        p_public_slug: publicSlug,
        p_data: withInputList,
        p_archived: false,
        p_expected_revision: 2,
        p_client_id: 'e2e-monotonic-writer',
      })
      expect(finalWrite.error).toBeNull()
      expect(finalWrite.data[0].revision).toBe(3)

      await page.getByRole('button', { name: `Abrir ${name}` }).click()
      await expect(page.getByLabel('Nombre del show')).toHaveValue(name)
      await expect(page.getByText(/Revision-safe console$/)).toBeVisible()

      await page.getByRole('button', { name: 'Input list', exact: true }).click()
      const continueButton = page.getByRole('button', { name: 'Continuar' })
      if (await continueButton.isVisible().catch(() => false)) await continueButton.click()
      await expect(page.getByRole('heading', { name: 'Entradas' })).toBeVisible()
      await expect(page.getByText(/Revision-safe console$/)).toBeVisible()
      await page.getByRole('button', { name: 'Cerrar input list' }).click()

      // Keep the subscribed client open long enough for any earlier queued websocket event to be
      // delivered, then assert again that neither the visible Show nor remote row regressed.
      await page.waitForTimeout(1_000)
      await expect(page.getByText(/Revision-safe console$/)).toBeVisible()
      const { data: remote, error } = await admin.from('orion_shows').select('data,revision').eq('id', showId).maybeSingle()
      expect(error).toBeNull()
      expect(remote?.revision).toBe(3)
      expect((remote?.data as typeof withInputList).equipment[0].name).toBe('Revision-safe console')
      expect((remote?.data as typeof withInputList).inputList.rows[0].equipment).toBe('Revision-safe console')
    } finally {
      await admin.from('orion_shows').delete().in('id', [showId, probeId])
    }
  })
})
