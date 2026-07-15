import { db, type PendingMutation } from './db'
import { saveRemoteWorkspace } from './supabase'
import { useAppStore } from '../store'
import type { WorkspaceData } from '../types'

export type WorkspaceSyncOutcome = 'saved' | 'remote-wins' | 'pending'

/**
 * D-214 (docs/25-DECISION_LOG.md): Workspace (Library/Presets/Preferences) conflicts are
 * remote-wins. Extracted out of SyncController so this exact resolution — queue cleanup plus the
 * IndexedDB/Zustand update — can be exercised directly against a real Supabase instance in
 * tests/integration/, not only through a full React render.
 *
 * On a confirmed conflict (stale expected revision), the conflicting local mutation is discarded
 * outright — never resubmitted against the updated revision — and the latest remote Workspace
 * (already returned by the RPC's conflict branch) replaces it locally. Ordinary non-conflicting
 * saves are unaffected.
 */
export async function processWorkspaceMutation(mutation: PendingMutation, localWorkspace: WorkspaceData): Promise<WorkspaceSyncOutcome> {
  const result = await saveRemoteWorkspace(localWorkspace, mutation.expectedRevision)
  if (result.applied && result.row) {
    await db.pendingMutations.delete(mutation.id)
    await useAppStore.getState().applyRemoteWorkspace(result.row.data, result.row.revision)
    return 'saved'
  }
  if (!result.applied && result.reason === 'conflict' && result.row) {
    await db.pendingMutations.delete(mutation.id)
    await useAppStore.getState().applyRemoteWorkspace(result.row.data, result.row.revision)
    return 'remote-wins'
  }
  return 'pending'
}
