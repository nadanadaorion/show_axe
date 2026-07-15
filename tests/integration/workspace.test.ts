/**
 * Real Supabase integration tests for the shared Workspace document (Library,
 * Presets, Preferences bundled into orion_workspace — see
 * docs/14-SYNC_OFFLINE_AND_LOCKS.md: "Library, Presets, and Preferences are
 * synchronized as one Workspace document in the baseline.").
 *
 * The last test documents — but does not change — the existing local-last
 * retry policy for Workspace conflicts. docs/25-DECISION_LOG.md lists this
 * as an *open* decision requiring explicit product-owner approval; per
 * docs/00-SOURCE_OF_TRUTH.md's priority order that decision-log entry
 * outranks docs/21-ROADMAP.md's "policy decision and implementation" framing
 * of Milestone 2, so this suite verifies current behavior only.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newTestClient } from './env'

const config = await getSupabaseTestConfig()

describe.skipIf(!config)('Workspace (Library/Presets/Preferences) against a real Supabase instance', () => {
  let client: SupabaseClient

  beforeAll(() => {
    client = newTestClient(config!)
  })

  beforeEach(async () => {
    await client.from('orion_workspace').delete().eq('id', 'main')
  })

  it('6. saves and reads Library/Presets/Preferences as one Workspace document', async () => {
    const workspace = {
      presets: [{ id: 'preset-1', name: 'Standard Band', archived: false, equipmentCategories: [], equipment: [], people: [], schedule: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      library: { equipment: [{ id: 'lib-eq-1', name: 'SM58', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], people: [], categories: [], roles: [], personTypes: [], origins: [] },
      preferences: { dateFormat: 'dd/MM/yyyy', timeFormat: '24h', language: 'es', initialModule: 'shows', theme: 'system', showInputListWarnings: true },
    }

    const { data: saved, error } = await client.rpc('orion_save_workspace', { p_data: workspace, p_expected_revision: 0 })
    expect(error).toBeNull()
    expect(saved[0].applied).toBe(true)
    expect(saved[0].revision).toBe(1)

    const { data: read } = await client.from('orion_workspace').select('data,revision').eq('id', 'main').maybeSingle()
    expect(read?.revision).toBe(1)
    expect((read?.data as typeof workspace).presets[0].name).toBe('Standard Band')
    expect((read?.data as typeof workspace).library.equipment[0].name).toBe('SM58')
  })

  it('documents the existing local-last Workspace conflict policy (open decision, not changed here)', async () => {
    const base = { presets: [], library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] }, preferences: {} }
    const created = await client.rpc('orion_save_workspace', { p_data: base, p_expected_revision: 0 })
    const revision = created.data[0].revision

    // Remote moves on (e.g. another device saved Preferences).
    const remote = await client.rpc('orion_save_workspace', { p_data: { ...base, preferences: { theme: 'dark' } }, p_expected_revision: revision })
    expect(remote.data[0].applied).toBe(true)

    // A stale local write is rejected as a conflict, exactly like a Show write.
    const stale = await client.rpc('orion_save_workspace', { p_data: { ...base, preferences: { theme: 'light' } }, p_expected_revision: revision })
    expect(stale.data[0].applied).toBe(false)
    expect(stale.data[0].reason).toBe('conflict')

    // The documented baseline policy (src/components/SyncController.tsx `processMutation`)
    // retries once against the latest revision with the *local* payload — local wins,
    // with no user-visible comparison. This is intentionally not a Show-style
    // conflict prompt; it remains an open decision pending explicit approval.
    const retried = await client.rpc('orion_save_workspace', { p_data: { ...base, preferences: { theme: 'light' } }, p_expected_revision: stale.data[0].revision })
    expect(retried.data[0].applied).toBe(true)
    expect((retried.data[0].data as typeof base & { preferences: { theme: string } }).preferences.theme).toBe('light')
  })
})
