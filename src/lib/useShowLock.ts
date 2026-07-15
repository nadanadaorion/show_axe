import { useCallback, useEffect, useRef, useState } from 'react'
import { isRuntimeConfigured } from './config'
import { acquireRemoteLock, releaseRemoteLock, releaseRemoteLockKeepalive } from './supabase'
import { getClientId, getDeviceLabel } from './utils'

export type ShowLockStatus = 'checking' | 'owned' | 'blocked' | 'offline' | 'idle' | 'waiting' | 'error'

export interface ShowLockState {
  status: ShowLockStatus
  deviceLabel?: string
  expiresAt?: string
  error?: string
}

const INACTIVITY_MS = 10 * 60 * 1000
const HEARTBEAT_MS = 30 * 1000

export function useShowLock(showId: string) {
  const [state, setState] = useState<ShowLockState>({ status: navigator.onLine ? 'checking' : 'offline' })
  const lastActivity = useRef(Date.now())
  const released = useRef(false)
  const retryTimer = useRef<number>()
  const clientId = useRef(getClientId())
  const deviceLabel = useRef(getDeviceLabel())

  const acquire = useCallback(async () => {
    if (!isRuntimeConfigured() || !navigator.onLine) {
      setState({ status: 'offline' })
      return
    }
    try {
      const result = await acquireRemoteLock(showId, clientId.current, deviceLabel.current, (Date.now() - lastActivity.current) / 1000)
      if (result.acquired) {
        released.current = false
        setState({ status: 'owned', deviceLabel: result.deviceLabel, expiresAt: result.expiresAt })
      } else if (result.ownerClientId) {
        setState({ status: 'blocked', deviceLabel: result.deviceLabel, expiresAt: result.expiresAt })
      } else {
        setState({ status: 'waiting' })
        window.clearTimeout(retryTimer.current)
        retryTimer.current = window.setTimeout(() => void acquire(), 1_500)
      }
    } catch (error) {
      setState({ status: navigator.onLine ? 'error' : 'offline', error: error instanceof Error ? error.message : 'No fue posible bloquear el show.' })
    }
  }, [showId])

  const release = useCallback(async () => {
    if (released.current) return
    released.current = true
    try {
      await releaseRemoteLock(showId, clientId.current)
    } catch {
      // The lock expires automatically after ten minutes if the release request cannot be delivered.
    }
  }, [showId])

  useEffect(() => {
    lastActivity.current = Date.now()
    void acquire()

    const onActivity = () => {
      lastActivity.current = Date.now()
      if (released.current && navigator.onLine) void acquire()
    }
    const onOnline = () => void acquire()
    const onOffline = () => setState({ status: 'offline' })
    const onPageHide = () => releaseRemoteLockKeepalive(showId, clientId.current)
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'input', 'touchstart']
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('pagehide', onPageHide)

    const interval = window.setInterval(() => {
      if (!navigator.onLine) {
        setState({ status: 'offline' })
        return
      }
      const inactive = Date.now() - lastActivity.current >= INACTIVITY_MS
      if (inactive) {
        void release().then(() => setState({ status: 'idle' }))
        return
      }
      void acquire()
    }, HEARTBEAT_MS)

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity))
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('pagehide', onPageHide)
      window.clearInterval(interval)
      window.clearTimeout(retryTimer.current)
      void release()
    }
  }, [acquire, release, showId])

  return {
    ...state,
    canEdit: state.status === 'owned' || state.status === 'offline' || state.status === 'waiting' || state.status === 'error',
    retry: acquire,
  }
}
