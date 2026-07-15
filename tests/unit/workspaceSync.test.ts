// Must run before importing src/lib/db.ts, which instantiates Dexie (and therefore opens
// IndexedDB) at module load time.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type PendingMutation } from '../../src/lib/db'
import { useAppStore } from '../../src/store'
import { processWorkspaceMutation } from '../../src/lib/workspaceSync'
import { saveRemoteWorkspace } from '../../src/lib/supabase'
import { buildWorkspace } from '../fixtures/builders'

vi.mock('../../src/lib/supabase', () => ({ saveRemoteWorkspace: vi.fn() }))

/**
 * D-214 (docs/25-DECISION_LOG.md): Workspace conflicts are remote-wins. This mocks the network
 * boundary (saveRemoteWorkspace) to deterministically drive each branch — the real branch and its
 * effect against a live Supabase instance are covered without mocks in
 * tests/integration/workspace.test.ts.
 */
const baseMutation: PendingMutation = { id: 'workspace', kind: 'workspace-upsert', entityId: 'main', expectedRevision: 1, queuedAt: '2026-01-01T00:00:00.000Z' }

describe('processWorkspaceMutation', () => {
  beforeEach(async () => {
    vi.mocked(saveRemoteWorkspace).mockReset()
    await db.pendingMutations.clear()
    await db.syncRecords.clear()
    await db.pendingMutations.put({ ...baseMutation, workspace: buildWorkspace() })
  })

  it('1. a normal save without conflict applies and clears the pending mutation', async () => {
    const remoteRow = { id: 'main' as const, data: buildWorkspace({ preferences: { ...buildWorkspace().preferences, theme: 'dark' as const } }), revision: 2, updated_at: '2026-01-01T00:00:00.000Z' }
    vi.mocked(saveRemoteWorkspace).mockResolvedValue({ applied: true, reason: 'saved', row: remoteRow })

    const localWorkspace = buildWorkspace()
    const outcome = await processWorkspaceMutation({ ...baseMutation, workspace: localWorkspace }, localWorkspace)

    expect(outcome).toBe('saved')
    expect(saveRemoteWorkspace).toHaveBeenCalledTimes(1)
    expect(await db.pendingMutations.get('workspace')).toBeUndefined()
    expect(useAppStore.getState().preferences.theme).toBe('dark')
    expect((await db.syncRecords.get('workspace'))?.revision).toBe(2)
  })

  it('2. on a confirmed conflict, resolves remote-wins with exactly one save attempt (no local retry)', async () => {
    const remoteRow = { id: 'main' as const, data: buildWorkspace({ preferences: { ...buildWorkspace().preferences, theme: 'dark' as const } }), revision: 3, updated_at: '2026-01-01T00:00:00.000Z' }
    vi.mocked(saveRemoteWorkspace).mockResolvedValue({ applied: false, reason: 'conflict', row: remoteRow })

    const localConflicting = buildWorkspace({ preferences: { ...buildWorkspace().preferences, theme: 'light' as const } })
    const outcome = await processWorkspaceMutation({ ...baseMutation, workspace: localConflicting }, localConflicting)

    expect(outcome).toBe('remote-wins')
    expect(saveRemoteWorkspace).toHaveBeenCalledTimes(1)
    // 5. the pending mutation based on the stale revision is gone.
    expect(await db.pendingMutations.get('workspace')).toBeUndefined()
    // 6 & 7. IndexedDB and Zustand reflect the remote version, not the discarded local one.
    expect(useAppStore.getState().preferences.theme).toBe('dark')
    expect((await db.preferences.get('main'))?.theme).toBe('dark')
    expect((await db.syncRecords.get('workspace'))?.revision).toBe(3)
  })

  it('leaves the mutation pending for a later retry on any other RPC outcome', async () => {
    vi.mocked(saveRemoteWorkspace).mockResolvedValue({ applied: false, reason: 'missing' })

    const localWorkspace = buildWorkspace()
    const outcome = await processWorkspaceMutation({ ...baseMutation, workspace: localWorkspace }, localWorkspace)

    expect(outcome).toBe('pending')
    expect(await db.pendingMutations.get('workspace')).toBeDefined()
  })
})
