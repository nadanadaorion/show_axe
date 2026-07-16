// Must run before importing src/lib/db.ts, which instantiates Dexie (and
// therefore opens IndexedDB) at module load time.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/lib/db'
import {
  acknowledgeShowMutation,
  pendingMutationCount,
  queueShowDelete,
  queueShowUpsert,
  queueWorkspaceUpsert,
} from '../../src/lib/syncQueue'
import { buildEmptyShow, buildWorkspace, resetFixtureSequence } from '../fixtures/builders'

/**
 * Item 14 of the Milestone 2 test list ("offline queue"): this exercises the
 * real coalescing logic in src/lib/syncQueue.ts against a real (in-memory,
 * spec-compliant) IndexedDB via fake-indexeddb — not a mock of the queue's
 * own behavior, and not Supabase. Reconnection/flush against a live backend
 * (item 15) is covered by the gated E2E suite in tests/e2e/, since it needs
 * the full app (Dexie + store + SyncController + network).
 */
beforeEach(async () => {
  resetFixtureSequence()
  await db.pendingMutations.clear()
  await db.syncRecords.clear()
})

describe('offline mutation queue coalescing', () => {
  it('coalesces repeated edits to the same Show into a single pending mutation, keeping the latest payload', async () => {
    const show = buildEmptyShow({ id: 'show-1', name: 'First' })
    await queueShowUpsert(show)
    await queueShowUpsert({ ...show, name: 'Second' })
    await queueShowUpsert({ ...show, name: 'Third' })

    const pending = await db.pendingMutations.toArray()
    expect(pending).toHaveLength(1)
    expect(pending[0].kind).toBe('show-upsert')
    expect(pending[0].show?.name).toBe('Third')
    expect(pending[0].generation).toBe(3)
  })

  it('acknowledges only the generation sent and rebases a newer coalesced edit', async () => {
    const show = buildEmptyShow({ id: 'show-race', name: 'Creating' })
    await queueShowUpsert(show)
    const inFlight = await db.pendingMutations.get('show:show-race')
    expect(inFlight).toBeDefined()

    await queueShowUpsert({ ...show, name: 'Edited while creating' })
    await expect(acknowledgeShowMutation(inFlight!, 1)).resolves.toBe('rebased')

    const pending = await db.pendingMutations.get('show:show-race')
    expect(pending?.show?.name).toBe('Edited while creating')
    expect(pending?.generation).toBe(2)
    expect(pending?.expectedRevision).toBe(1)
    expect((await db.syncRecords.get('show:show-race'))?.revision).toBe(1)
  })

  it('removes the exact generation after the server accepts it', async () => {
    const show = buildEmptyShow({ id: 'show-complete' })
    await queueShowUpsert(show)
    const inFlight = await db.pendingMutations.get('show:show-complete')

    await expect(acknowledgeShowMutation(inFlight!, 1)).resolves.toBe('completed')
    await expect(db.pendingMutations.get('show:show-complete')).resolves.toBeUndefined()
  })

  it('keeps the originally captured expected revision across a coalesced re-queue', async () => {
    await db.syncRecords.put({ id: 'show:show-1', revision: 4, syncedAt: '2026-01-01T00:00:00.000Z' })
    const show = buildEmptyShow({ id: 'show-1' })

    await queueShowUpsert(show)
    await queueShowUpsert({ ...show, name: 'Edited again' })

    const mutation = await db.pendingMutations.get('show:show-1')
    expect(mutation?.expectedRevision).toBe(4)
  })

  it('a queued delete replaces a previously queued upsert for the same Show', async () => {
    await queueShowUpsert(buildEmptyShow({ id: 'show-2' }))
    await queueShowDelete('show-2')

    const pending = await db.pendingMutations.toArray()
    expect(pending).toHaveLength(1)
    expect(pending[0].kind).toBe('show-delete')
    expect(pending[0].entityId).toBe('show-2')
  })

  it('queues at most one workspace-upsert mutation no matter how many edits happen', async () => {
    await queueWorkspaceUpsert(buildWorkspace())
    await queueWorkspaceUpsert(buildWorkspace({ preferences: { ...buildWorkspace().preferences, theme: 'dark' } }))
    await queueWorkspaceUpsert(buildWorkspace())

    const pending = await db.pendingMutations.where('kind').equals('workspace-upsert').toArray()
    expect(pending).toHaveLength(1)
  })

  it('pendingMutationCount reflects the queue after coalescing across Shows and the Workspace', async () => {
    await queueShowUpsert(buildEmptyShow({ id: 'show-3' }))
    await queueShowUpsert(buildEmptyShow({ id: 'show-3' })) // coalesces, does not add a second entry
    await queueShowUpsert(buildEmptyShow({ id: 'show-4' }))
    await queueWorkspaceUpsert(buildWorkspace())

    expect(await pendingMutationCount()).toBe(3)
  })
})
