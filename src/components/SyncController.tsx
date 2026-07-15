import { AlertTriangle, Cloud, CloudOff, GitCompareArrows, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { db, type PendingMutation } from '../lib/db'
import { isRuntimeConfigured } from '../lib/config'
import {
  deleteRemoteShow,
  fetchRemoteShows,
  fetchRemoteWorkspace,
  remoteRowToShow,
  removeRemoteChannel,
  saveRemoteShow,
  saveRemoteWorkspace,
  subscribeToRemoteChanges,
  type RemoteShowRow,
  type RemoteWorkspaceRow,
} from '../lib/supabase'
import { pendingMutationCount, SYNC_NEEDED_EVENT } from '../lib/syncQueue'
import { getClientId, now, uid } from '../lib/utils'
import { processWorkspaceMutation } from '../lib/workspaceSync'
import { useAppStore } from '../store'
import { useSyncStore } from '../syncStore'
import type { ShowConflict, WorkspaceData } from '../types'
import { Button, Modal } from './ui'
import { useToast } from './Toast'

const clientId = typeof window !== 'undefined' ? getClientId() : ''

function workspaceFromStore(): WorkspaceData {
  const state = useAppStore.getState()
  return {
    presets: structuredClone(state.presets),
    library: structuredClone(state.library),
    preferences: structuredClone(state.preferences),
  }
}

async function refreshPendingCount() {
  useSyncStore.getState().setPendingCount(await pendingMutationCount())
}

async function handleRemoteShow(row: RemoteShowRow) {
  const pending = await db.pendingMutations.get(`show:${row.id}`)
  if (pending) return
  const record = await db.syncRecords.get(`show:${row.id}`)
  if (record?.revision === row.revision) return
  await useAppStore.getState().applyRemoteShow(remoteRowToShow(row), row.revision)
}

async function handleRemoteWorkspace(row: RemoteWorkspaceRow) {
  if (await db.pendingMutations.get('workspace')) return
  const record = await db.syncRecords.get('workspace')
  if (record?.revision === row.revision) return
  await useAppStore.getState().applyRemoteWorkspace(row.data, row.revision)
}

function conflictFrom(mutation: PendingMutation, remote: RemoteShowRow): ShowConflict {
  return {
    id: uid(),
    showId: mutation.entityId,
    operation: mutation.kind === 'show-delete' ? 'delete' : 'upsert',
    localShow: mutation.show,
    remoteShow: remoteRowToShow(remote),
    remoteRevision: remote.revision,
    createdAt: now(),
  }
}

function conflictWithRemoteDeletion(mutation: PendingMutation): ShowConflict {
  return {
    id: uid(),
    showId: mutation.entityId,
    operation: mutation.kind === 'show-delete' ? 'delete' : 'upsert',
    localShow: mutation.show,
    remoteRevision: 0,
    remoteDeleted: true,
    createdAt: now(),
  }
}

export function SyncController({ children }: { children: ReactNode }) {
  const syncing = useRef(false)
  const rerun = useRef(false)
  const subscription = useRef<ReturnType<typeof subscribeToRemoteChanges>>()
  const [resolving, setResolving] = useState(false)
  const { showToast } = useToast()
  const conflict = useSyncStore((state) => state.conflicts[0])

  const setSettledStatus = useCallback(async () => {
    const sync = useSyncStore.getState()
    const count = await pendingMutationCount()
    sync.setPendingCount(count)
    if (sync.conflicts.length) sync.setStatus('conflict')
    else if (!navigator.onLine) sync.setStatus('offline')
    else if (count) sync.setStatus('syncing')
    else {
      sync.setStatus('synced')
      sync.setLastSyncedAt(now())
    }
  }, [])

  const processMutation = useCallback(async (mutation: PendingMutation) => {
    if (mutation.kind === 'workspace-upsert') {
      const localWorkspace = mutation.workspace || workspaceFromStore()
      const outcome = await processWorkspaceMutation(mutation, localWorkspace)
      // D-214 (docs/25-DECISION_LOG.md): Workspace conflicts are remote-wins.
      // processWorkspaceMutation already discarded the conflicting local mutation and replaced the
      // local Workspace with the latest remote one; this only owns the user-facing notification.
      if (outcome === 'remote-wins') {
        showToast('Se conservaron los cambios en línea porque este espacio fue modificado desde otro dispositivo.')
      }
      return
    }

    if (mutation.kind === 'show-upsert' && mutation.show) {
      const result = await saveRemoteShow(mutation.show, mutation.expectedRevision, clientId)
      if (result.applied && result.row) {
        await db.pendingMutations.delete(mutation.id)
        await useAppStore.getState().applyRemoteShow(remoteRowToShow(result.row), result.row.revision)
      } else if (result.reason === 'conflict' && result.row) {
        useSyncStore.getState().addConflict(conflictFrom(mutation, result.row))
      } else if (result.reason === 'missing' && mutation.expectedRevision > 0) {
        useSyncStore.getState().addConflict(conflictWithRemoteDeletion(mutation))
      }
      return
    }

    if (mutation.kind === 'show-delete') {
      const result = await deleteRemoteShow(mutation.entityId, mutation.expectedRevision, clientId)
      if (result.applied || result.reason === 'missing') {
        await db.pendingMutations.delete(mutation.id)
        await useAppStore.getState().removeRemoteShow(mutation.entityId)
      } else if (result.reason === 'conflict' && result.row) {
        useSyncStore.getState().addConflict(conflictFrom(mutation, result.row))
      }
    }
  }, [showToast])

  const syncNow = useCallback(async () => {
    if (!isRuntimeConfigured()) {
      useSyncStore.getState().setStatus('unconfigured')
      return
    }
    if (!navigator.onLine) {
      await refreshPendingCount()
      useSyncStore.getState().setStatus('offline')
      return
    }
    if (syncing.current) {
      rerun.current = true
      return
    }

    syncing.current = true
    useSyncStore.getState().setStatus('syncing')
    try {
      const [remoteShows, remoteWorkspace] = await Promise.all([fetchRemoteShows(), fetchRemoteWorkspace()])
      const pending = await db.pendingMutations.toArray()
      const pendingIds = new Set(pending.filter((item) => item.kind !== 'workspace-upsert').map((item) => item.entityId))
      const remoteIds = new Set(remoteShows.map((row) => row.id))

      for (const row of remoteShows) {
        if (!pendingIds.has(row.id)) await handleRemoteShow(row)
      }

      // A clean local show that disappeared remotely was deleted from another device.
      const currentShows = useAppStore.getState().shows
      for (const show of currentShows) {
        if (pendingIds.has(show.id) || remoteIds.has(show.id)) continue
        if (await db.syncRecords.get(`show:${show.id}`)) await useAppStore.getState().removeRemoteShow(show.id)
      }

      const workspacePending = pending.some((item) => item.kind === 'workspace-upsert')
      if (!workspacePending) {
        if (remoteWorkspace) await handleRemoteWorkspace(remoteWorkspace)
        else {
          const result = await saveRemoteWorkspace(workspaceFromStore(), 0)
          if (result.applied && result.row) await useAppStore.getState().applyRemoteWorkspace(result.row.data, result.row.revision)
        }
      }

      for (const mutation of pending) {
        const alreadyConflicted = useSyncStore.getState().conflicts.some((item) => item.showId === mutation.entityId)
        if (!alreadyConflicted) await processMutation(mutation)
      }
      await setSettledStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible sincronizar con Supabase.'
      useSyncStore.getState().setStatus(navigator.onLine ? 'error' : 'offline', message)
    } finally {
      syncing.current = false
      if (rerun.current) {
        rerun.current = false
        window.setTimeout(() => void syncNow(), 50)
      }
    }
  }, [processMutation, setSettledStatus])

  useEffect(() => {
    void syncNow()
    const onOnline = () => void syncNow()
    const onOffline = () => useSyncStore.getState().setStatus('offline')
    const onNeeded = () => window.setTimeout(() => void syncNow(), 300)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(SYNC_NEEDED_EVENT, onNeeded)
    const interval = window.setInterval(() => void syncNow(), 60_000)

    if (isRuntimeConfigured()) {
      subscription.current = subscribeToRemoteChanges({
        onShowUpsert: (row) => void handleRemoteShow(row),
        onShowDelete: (id) => {
          if (!id) return
          void db.pendingMutations.get(`show:${id}`).then((pending) => {
            if (!pending) void useAppStore.getState().removeRemoteShow(id)
          })
        },
        onWorkspace: (row) => void handleRemoteWorkspace(row),
        onStatus: (status, error) => {
          // Chromium can emit the offline event before Supabase reports CHANNEL_ERROR. Offline is
          // the more useful observable state and must not be overwritten by that expected channel
          // shutdown while the browser has no network.
          if (!navigator.onLine) {
            useSyncStore.getState().setStatus('offline')
            return
          }
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && error) {
            useSyncStore.getState().setStatus('error', 'La conexión en tiempo real se interrumpió. La sincronización periódica sigue activa.')
          }
        },
      })
    }

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(SYNC_NEEDED_EVENT, onNeeded)
      window.clearInterval(interval)
      void removeRemoteChannel(subscription.current)
    }
  }, [syncNow])

  const chooseOnline = async () => {
    if (!conflict) return
    setResolving(true)
    try {
      await db.pendingMutations.delete(`show:${conflict.showId}`)
      if (conflict.remoteShow) await useAppStore.getState().applyRemoteShow(conflict.remoteShow, conflict.remoteRevision)
      else await useAppStore.getState().removeRemoteShow(conflict.showId)
      useSyncStore.getState().removeConflict(conflict.id)
      await setSettledStatus()
      showToast('Se conservó la versión en línea')
    } finally {
      setResolving(false)
    }
  }

  const chooseLocal = async () => {
    if (!conflict) return
    setResolving(true)
    try {
      if (conflict.operation === 'delete') {
        const result = await deleteRemoteShow(conflict.showId, conflict.remoteRevision, clientId)
        if (!result.applied && result.reason === 'locked') {
          showToast('El show está siendo editado en otro dispositivo. Intenta resolverlo cuando se libere.')
          return
        }
        if (!result.applied && result.reason === 'conflict' && result.row) {
          useSyncStore.getState().addConflict(conflictFrom(await db.pendingMutations.get(`show:${conflict.showId}`) || { id: `show:${conflict.showId}`, kind: 'show-delete', entityId: conflict.showId, expectedRevision: conflict.remoteRevision, queuedAt: now() }, result.row))
          return
        }
        if (!result.applied) throw new Error('No fue posible conservar la eliminación local.')
        await db.pendingMutations.delete(`show:${conflict.showId}`)
        await useAppStore.getState().removeRemoteShow(conflict.showId)
      } else if (conflict.localShow) {
        const result = await saveRemoteShow(conflict.localShow, conflict.remoteRevision, clientId)
        if (!result.applied && result.reason === 'locked') {
          showToast('El show está siendo editado en otro dispositivo. Intenta resolverlo cuando se libere.')
          return
        }
        if (!result.applied && result.reason === 'conflict' && result.row) {
          const mutation = await db.pendingMutations.get(`show:${conflict.showId}`)
          if (mutation) useSyncStore.getState().addConflict(conflictFrom(mutation, result.row))
          return
        }
        if (!result.applied || !result.row) throw new Error('No fue posible guardar la versión local.')
        await db.pendingMutations.delete(`show:${conflict.showId}`)
        await useAppStore.getState().applyRemoteShow(remoteRowToShow(result.row), result.row.revision)
      }
      useSyncStore.getState().removeConflict(conflict.id)
      await setSettledStatus()
      showToast('Se conservó la versión local')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible resolver el conflicto')
    } finally {
      setResolving(false)
    }
  }

  return <>
    {children}
    <Modal open={Boolean(conflict)} title="Conflicto de edición offline" onClose={() => undefined} closeOnEscape={false} footer={<><Button variant="secondary" disabled={resolving} onClick={chooseOnline}><Cloud size={16} />Conservar versión en línea</Button><Button disabled={resolving} onClick={chooseLocal}>{resolving ? <LoaderCircle className="animate-spin" size={16} /> : <CloudOff size={16} />}Conservar versión local</Button></>}>
      {conflict && <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 flex-none" size={20} /><div><p className="text-sm font-medium">Este show cambió localmente y también en línea.</p><p className="mt-1 text-xs opacity-80">Selecciona cuál versión debe conservarse. La otra será reemplazada y no se creará una copia adicional.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CloudOff size={16} />Versión local</div><p className="text-sm">{conflict.operation === 'delete' ? 'El show fue eliminado en este dispositivo.' : conflict.localShow?.name || 'Show local'}</p><p className="mt-1 text-xs muted">Cambio pendiente desde este dispositivo.</p></div>
          <div className="rounded-xl border border-[var(--line)] p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Cloud size={16} />Versión en línea</div><p className="text-sm">{conflict.remoteShow ? conflict.remoteShow.name : 'El show fue eliminado en línea.'}</p><p className="mt-1 text-xs muted">{conflict.remoteShow ? `Última edición: ${new Date(conflict.remoteShow.updatedAt).toLocaleString()}` : 'Conservar esta versión eliminará la copia local.'}</p></div>
        </div>
        <div className="flex items-center gap-2 text-xs muted"><GitCompareArrows size={15} />Mientras no elijas una versión, este show seguirá pendiente de sincronización.</div>
      </div>}
    </Modal>
  </>
}

export function SyncStatusBadge() {
  const status = useSyncStore((state) => state.status)
  const pending = useSyncStore((state) => state.pendingCount)
  const error = useSyncStore((state) => state.error)
  const details = {
    unconfigured: ['Sin configurar', CloudOff],
    connecting: ['Conectando…', LoaderCircle],
    syncing: [pending ? `Sincronizando ${pending}` : 'Sincronizando…', LoaderCircle],
    synced: ['Guardado en línea', Cloud],
    offline: [pending ? `Sin conexión · ${pending} pendiente${pending === 1 ? '' : 's'}` : 'Sin conexión', CloudOff],
    conflict: ['Conflicto pendiente', AlertTriangle],
    error: ['Error de sincronización', AlertTriangle],
  } as const
  const [label, Icon] = details[status]
  return <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-xs" title={error}><div className="mb-1 flex items-center gap-2 font-medium text-[var(--text)]"><Icon className={status === 'connecting' || status === 'syncing' ? 'animate-spin' : ''} size={14} />{label}</div><div className="muted">{status === 'synced' ? 'Los cambios se comparten entre dispositivos.' : status === 'offline' ? 'Puedes seguir trabajando; se sincronizará al volver.' : error || 'Espacio compartido sin cuentas.'}</div></div>
}
