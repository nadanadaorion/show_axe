import { useCallback, useEffect, useRef, useState } from 'react'

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

    const watchInstalling = (worker: ServiceWorker | null | undefined, hadController: boolean) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && hadController) {
          waitingWorkerRef.current = worker
          setUpdateAvailable(true)
        }
      })
    }

    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        if (cancelled) return
        registrationRef.current = registration

        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorkerRef.current = registration.waiting
          setUpdateAvailable(true)
        }

        registration.addEventListener('updatefound', () => {
          watchInstalling(registration.installing, Boolean(navigator.serviceWorker.controller))
        })

        const interval = window.setInterval(() => registration.update().catch(() => undefined), UPDATE_CHECK_INTERVAL_MS)
        return () => window.clearInterval(interval)
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
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.clearTimeout(timeoutRef.current)
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
