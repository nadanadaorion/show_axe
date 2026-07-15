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
      queuedAt: existing?.queuedAt || now(),
    })
    notifySyncNeeded()
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
