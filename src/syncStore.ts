import { create } from 'zustand'
import type { ShowConflict, SyncStatus } from './types'

interface SyncState {
  status: SyncStatus
  error?: string
  pendingCount: number
  lastSyncedAt?: string
  conflicts: ShowConflict[]
  setStatus: (status: SyncStatus, error?: string) => void
  setPendingCount: (count: number) => void
  setLastSyncedAt: (value: string) => void
  addConflict: (conflict: ShowConflict) => void
  removeConflict: (id: string) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'connecting',
  pendingCount: 0,
  conflicts: [],
  setStatus: (status, error) => set({ status, error }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  addConflict: (conflict) => set((state) => ({
    conflicts: [...state.conflicts.filter((item) => item.showId !== conflict.showId), conflict],
    status: 'conflict',
  })),
  removeConflict: (id) => set((state) => ({ conflicts: state.conflicts.filter((item) => item.id !== id) })),
}))
