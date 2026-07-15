// @vitest-environment jsdom
/**
 * Real Supabase integration tests for the shared Workspace document (Library,
 * Presets, Preferences bundled into orion_workspace — see
 * docs/14-SYNC_OFFLINE_AND_LOCKS.md: "Library, Presets, and Preferences are
 * synchronized as one Workspace document in the baseline.").
 *
 * D-214 (docs/25-DECISION_LOG.md) closes the Workspace conflict policy as
 * remote-wins, replacing the old local-last retry. This file exercises the
 * real client-side resolution — src/lib/workspaceSync.ts's
 * processWorkspaceMutation, exactly what src/components/SyncController.tsx
 * calls — against this real local Supabase instance, never a mock. A second
 * real @supabase/supabase-js client plays "the other device" that produces
 * the conflict, so this also satisfies "integration real contra Supabase
 * valida el conflicto entre dos clientes."
 *
 * `@vitest-environment jsdom` (unlike every other file in this directory) is
 * required because processWorkspaceMutation exercises the real
 * src/lib/supabase.ts + src/lib/config.ts + src/store.ts + src/lib/db.ts,
 * which need window.__ORION_CONFIG__, localStorage, and IndexedDB
 * (fake-indexeddb below) exactly as the shipped app does.
 */
import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newTestClient } from './env'
import { buildWorkspace } from '../fixtures/builders'
import { db } from '../../src/lib/db'
import { useAppStore } from '../../src/store'
import * as supabaseLib from '../../src/lib/supabase'
import { processWorkspaceMutation } from '../../src/lib/workspaceSync'
import { queueWorkspaceUpsert } from '../../src/lib/syncQueue'

const config = await getSupabaseTestConfig()

describe.skipIf(!config)('Workspace (Library/Presets/Preferences) against a real Supabase instance', () => {
  let client: SupabaseClient

  beforeAll(() => {
    client = newTestClient(config!)
    // Points the real app modules (src/lib/supabase.ts, via src/lib/config.ts) at the same local
    // instance the other integration tests use — the same mechanism
    // tests/e2e/supabaseTestConfig.ts uses for Playwright, just injected directly here.
    window.__ORION_CONFIG__ = { supabaseUrl: config!.url, supabasePublishableKey: config!.anonKey }
  })

  beforeEach(async () => {
    await client.from('orion_workspace').delete().eq('id', 'main')
    await db.pendingMutations.clear()
    await db.syncRecords.clear()
    await db.presets.clear()
    await db.categories.clear()
    useAppStore.setState({ presets: [], library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] }, preferences: buildWorkspace().preferences })
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

  it('D-214: a non-conflicting Workspace save applies normally through processWorkspaceMutation', async () => {
    const workspace = buildWorkspace({ preferences: { ...buildWorkspace().preferences, theme: 'dark' } })
    await queueWorkspaceUpsert(workspace)
    const mutation = await db.pendingMutations.get('workspace')
    expect(mutation).toBeDefined()

    const outcome = await processWorkspaceMutation(mutation!, workspace)
    expect(outcome).toBe('saved')

    // 5. the pending mutation is gone.
    expect(await db.pendingMutations.get('workspace')).toBeUndefined()
    // 6. IndexedDB reflects the saved Workspace.
    expect((await db.preferences.get('main'))?.theme).toBe('dark')
    // 7. Zustand reflects the saved Workspace.
    expect(useAppStore.getState().preferences.theme).toBe('dark')

    const { data: remote } = await client.from('orion_workspace').select('data,revision').eq('id', 'main').maybeSingle()
    expect(remote?.revision).toBe(1)
    expect((remote?.data as typeof workspace).preferences.theme).toBe('dark')
  })

  it('D-214: a confirmed conflict discards the local mutation and applies the remote Workspace, without retrying the local save', async () => {
    // Establish revision 1, then have a second real client (the "other device") advance it to
    // revision 2 with content this test can tell apart from the local, conflicting change below.
    const base = buildWorkspace({ presets: [], library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] } })
    const created = await client.rpc('orion_save_workspace', { p_data: base, p_expected_revision: 0 })
    expect(created.data[0].applied).toBe(true)

    const remoteWinning = { ...base, library: { ...base.library, categories: [{ id: 'cat-remote', name: 'Remote category', order: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] }, preferences: { ...base.preferences, theme: 'dark' as const } }
    const remoteWrite = await client.rpc('orion_save_workspace', { p_data: remoteWinning, p_expected_revision: 1 })
    expect(remoteWrite.data[0].applied).toBe(true)
    expect(remoteWrite.data[0].revision).toBe(2)

    // Device A queued a conflicting local change while it still expected revision 1.
    const localConflicting = { ...base, library: { ...base.library, categories: [{ id: 'cat-local', name: 'Local category', order: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] }, preferences: { ...base.preferences, theme: 'light' as const } }
    await db.pendingMutations.put({ id: 'workspace', kind: 'workspace-upsert', entityId: 'main', expectedRevision: 1, queuedAt: '2026-01-01T00:00:00.000Z', workspace: localConflicting })
    const mutation = await db.pendingMutations.get('workspace')

    const saveSpy = vi.spyOn(supabaseLib, 'saveRemoteWorkspace')
    const outcome = await processWorkspaceMutation(mutation!, localConflicting)
    expect(outcome).toBe('remote-wins')

    // 2. exactly one save attempt — no automatic retry against the updated revision.
    expect(saveSpy).toHaveBeenCalledTimes(1)
    saveSpy.mockRestore()

    // 5. the pending mutation based on the stale revision is gone from the queue.
    expect(await db.pendingMutations.get('workspace')).toBeUndefined()

    // 3 & 7. the remote version replaces Library/Presets/Preferences in Zustand.
    const state = useAppStore.getState()
    expect(state.library.categories[0]?.name).toBe('Remote category')
    expect(state.preferences.theme).toBe('dark')

    // 6. IndexedDB reflects the remote version, not the local conflicting one.
    const categories = await db.categories.toArray()
    expect(categories).toHaveLength(1)
    expect(categories[0].name).toBe('Remote category')
    expect((await db.preferences.get('main'))?.theme).toBe('dark')

    // 4. the local conflicting version never reached Supabase — the remote row still holds
    // exactly what the "other device" wrote, unmodified by any retry.
    const { data: remote } = await client.from('orion_workspace').select('data,revision').eq('id', 'main').maybeSingle()
    expect(remote?.revision).toBe(2)
    expect((remote?.data as typeof remoteWinning).library.categories[0]?.name).toBe('Remote category')
    expect((remote?.data as typeof remoteWinning).preferences.theme).toBe('dark')
  })

  it('D-214: a conflict produced by an offline edit still keeps the remote version once the queue is processed on reconnect', async () => {
    // "Offline" here means what it means to this queue: a mutation sits pending with the
    // revision that was current when it was queued, unconfirmed against Supabase, exactly what
    // happens while navigator.onLine is false (see src/components/SyncController.tsx syncNow,
    // which calls processMutation for every pending mutation once it comes back online).
    const base = buildWorkspace({ presets: [], library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] } })
    const created = await client.rpc('orion_save_workspace', { p_data: base, p_expected_revision: 0 })
    expect(created.data[0].applied).toBe(true)

    // Queue the local ("offline") edit while revision 1 is still current.
    const offlineEdit = { ...base, preferences: { ...base.preferences, theme: 'light' as const } }
    await queueWorkspaceUpsert(offlineEdit)

    // While still offline, another device saves and moves the revision on.
    const remoteWrite = await client.rpc('orion_save_workspace', { p_data: { ...base, preferences: { ...base.preferences, theme: 'dark' as const } }, p_expected_revision: 1 })
    expect(remoteWrite.data[0].applied).toBe(true)

    // Reconnect: the queue is processed exactly like SyncController's syncNow does.
    const mutation = await db.pendingMutations.get('workspace')
    const outcome = await processWorkspaceMutation(mutation!, offlineEdit)

    expect(outcome).toBe('remote-wins')
    expect(useAppStore.getState().preferences.theme).toBe('dark')
    expect(await db.pendingMutations.get('workspace')).toBeUndefined()
    const { data: remote } = await client.from('orion_workspace').select('data').eq('id', 'main').maybeSingle()
    expect((remote?.data as typeof base).preferences.theme).toBe('dark')
  })

  it('documents the unchanged RPC-level optimistic-concurrency contract the client-side remote-wins resolution depends on', async () => {
    const base = { presets: [], library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] }, preferences: {} }
    const created = await client.rpc('orion_save_workspace', { p_data: base, p_expected_revision: 0 })
    const revision = created.data[0].revision

    const remote = await client.rpc('orion_save_workspace', { p_data: { ...base, preferences: { theme: 'dark' } }, p_expected_revision: revision })
    expect(remote.data[0].applied).toBe(true)

    // A stale write is rejected as a conflict, and the RPC returns the current remote row — this
    // is exactly what processWorkspaceMutation relies on to apply the remote-wins resolution
    // without a second round-trip to fetch it separately.
    const stale = await client.rpc('orion_save_workspace', { p_data: { ...base, preferences: { theme: 'light' } }, p_expected_revision: revision })
    expect(stale.data[0].applied).toBe(false)
    expect(stale.data[0].reason).toBe('conflict')
    expect(stale.data[0].revision).toBe(remote.data[0].revision)
    expect((stale.data[0].data as typeof base & { preferences: { theme: string } }).preferences.theme).toBe('dark')
  })
})
