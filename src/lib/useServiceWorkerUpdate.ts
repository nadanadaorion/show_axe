import { useCallback, useEffect, useRef, useState } from 'react'
import { serviceWorkerRegistrationOptions } from './version'

export interface ServiceWorkerUpdateState {
  updateAvailable: boolean
  applying: boolean
  applyFailed: boolean
  applyUpdate: () => void
  retryCheck: () => void
}

// How long we wait for the browser to hand control to the new worker after SKIP_WAITING before
// treating the update as failed and offering a retry, instead of leaving the button spinning forever.
const APPLY_TIMEOUT_MS = 8_000
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyFailed, setApplyFailed] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration>()
  const waitingWorkerRef = useRef<ServiceWorker | null>(null)
  const applyingRef = useRef(false)
  const timeoutRef = useRef<number>()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let cancelled = false
    let interval: number | undefined
    let registration: ServiceWorkerRegistration | undefined
    let onUpdateFound: (() => void) | undefined
    const workerCleanups = new Set<() => void>()

    const watchInstalling = (worker: ServiceWorker | null | undefined, hadController: boolean) => {
      if (!worker) return
      const onStateChange = () => {
        if (!cancelled && worker.state === 'installed' && hadController) {
          waitingWorkerRef.current = worker
          setUpdateAvailable(true)
        }
      }
      worker.addEventListener('statechange', onStateChange)
      workerCleanups.add(() => worker.removeEventListener('statechange', onStateChange))
    }

    const { scriptURL, scope } = serviceWorkerRegistrationOptions()
    navigator.serviceWorker
      .register(scriptURL, { scope })
      .then((nextRegistration) => {
        if (cancelled) return
        registration = nextRegistration
        registrationRef.current = registration

        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorkerRef.current = registration.waiting
          setUpdateAvailable(true)
        }

        onUpdateFound = () => {
          watchInstalling(nextRegistration.installing, Boolean(navigator.serviceWorker.controller))
        }
        nextRegistration.addEventListener('updatefound', onUpdateFound)

        interval = window.setInterval(() => registration?.update().catch(() => undefined), UPDATE_CHECK_INTERVAL_MS)
      })
      .catch(() => undefined)

    const onControllerChange = () => {
      if (!applyingRef.current) return
      applyingRef.current = false
      window.clearTimeout(timeoutRef.current)
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      cancelled = true
      if (interval !== undefined) window.clearInterval(interval)
      if (onUpdateFound) registration?.removeEventListener('updatefound', onUpdateFound)
      workerCleanups.forEach((cleanup) => cleanup())
      workerCleanups.clear()
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.clearTimeout(timeoutRef.current)
      applyingRef.current = false
    }
  }, [])

  const applyUpdate = useCallback(() => {
    const waiting = waitingWorkerRef.current || registrationRef.current?.waiting
    if (!waiting) return
    setApplyFailed(false)
    setApplying(true)
    applyingRef.current = true
    waiting.postMessage({ type: 'SKIP_WAITING' })
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      if (!applyingRef.current) return
      applyingRef.current = false
      setApplying(false)
      setApplyFailed(true)
    }, APPLY_TIMEOUT_MS)
  }, [])

  const retryCheck = useCallback(() => {
    setApplyFailed(false)
    if (waitingWorkerRef.current || registrationRef.current?.waiting) {
      applyUpdate()
      return
    }
    registrationRef.current?.update().catch(() => undefined)
  }, [applyUpdate])

  return { updateAvailable, applying, applyFailed, applyUpdate, retryCheck }
}
