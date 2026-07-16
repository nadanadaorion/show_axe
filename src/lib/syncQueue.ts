import { db, type PendingMutation } from './db'
import { now } from './utils'
import type { Show, WorkspaceData } from '../types'

export const SYNC_NEEDED_EVENT = 'orion-shows:sync-needed'

let queueChain: Promise<unknown> = Promise.resolve()

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queueChain.then(work, work)
  queueChain = next.then(() => undefined, () => undefined)
  return next
}

function notifySyncNeeded() {
  window.dispatchEvent(new CustomEvent(SYNC_NEEDED_EVENT))
}

async function expectedRevision(id: string, existing?: PendingMutation) {
  if (existing) return existing.expectedRevision
  return (await db.syncRecords.get(id))?.revision || 0
}

export function queueShowUpsert(show: Show) {
  return serialize(async () => {
    const id = `show:${show.id}`
    const existing = await db.pendingMutations.get(id)
    await db.pendingMutations.put({
      id,
      kind: 'show-upsert',
      entityId: show.id,
      expectedRevision: await expectedRevision(id, existing),
      generation: (existing?.generation || 0) + 1,
      queuedAt: existing?.queuedAt || now(),
      show: structuredClone(show),
    })
    notifySyncNeeded()
  })
}

export function queueShowDelete(showId: string) {
  return serialize(async () => {
    const id = `show:${showId}`
    const existing = await db.pendingMutations.get(id)
    await db.pendingMutations.put({
      id,
      kind: 'show-delete',
      entityId: showId,
      expectedRevision: await expectedRevision(id, existing),
      generation: (existing?.generation || 0) + 1,
      queuedAt: existing?.queuedAt || now(),
    })
    notifySyncNeeded()
  })
}

export type ShowMutationAcknowledgement = 'completed' | 'rebased'

/**
 * Completes only the exact Show mutation that was sent. A local edit can replace
 * that entry while its RPC is in flight; in that case the newer payload must stay
 * queued against the revision just accepted by the server.
 */
export function acknowledgeShowMutation(mutation: PendingMutation, acceptedRevision: number) {
  return serialize(async (): Promise<ShowMutationAcknowledgement> => {
    const outcome = await db.transaction('rw', [db.pendingMutations, db.syncRecords], async () => {
      const current = await db.pendingMutations.get(mutation.id)
      if (!current || current.generation === mutation.generation) {
        if (current) await db.pendingMutations.delete(mutation.id)
        return 'completed' as const
      }

      await db.pendingMutations.put({ ...current, expectedRevision: acceptedRevision })
      const accepted = await db.syncRecords.get(mutation.id)
      if (!accepted || accepted.revision < acceptedRevision) {
        await db.syncRecords.put({ id: mutation.id, revision: acceptedRevision, syncedAt: now() })
      }
      return 'rebased' as const
    })

    if (outcome === 'rebased') notifySyncNeeded()
    return outcome
  })
}

export function rebasePendingShowMutation(id: string, acceptedRevision: number) {
  return serialize(async () => {
    const rebased = await db.transaction('rw', [db.pendingMutations, db.syncRecords], async () => {
      const current = await db.pendingMutations.get(id)
      if (!current) return false
      await db.pendingMutations.put({ ...current, expectedRevision: acceptedRevision })
      const accepted = await db.syncRecords.get(id)
      if (!accepted || accepted.revision < acceptedRevision) {
        await db.syncRecords.put({ id, revision: acceptedRevision, syncedAt: now() })
      }
      return true
    })
    if (rebased) notifySyncNeeded()
    return rebased
  })
}

export function queueWorkspaceUpsert(workspace: WorkspaceData) {
  return serialize(async () => {
    const id = 'workspace'
    const existing = await db.pendingMutations.get(id)
    await db.pendingMutations.put({
      id,
      kind: 'workspace-upsert',
      entityId: 'main',
      expectedRevision: await expectedRevision(id, existing),
      queuedAt: existing?.queuedAt || now(),
      workspace: structuredClone(workspace),
    })
    notifySyncNeeded()
  })
}

export async function pendingMutationCount() {
  await queueChain
  return db.pendingMutations.count()
}
