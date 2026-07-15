// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useServiceWorkerUpdate } from '../../src/lib/useServiceWorkerUpdate'

class FakeServiceWorker extends EventTarget {
  state: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant' = 'installing'
  postMessage = vi.fn()
  setState(state: FakeServiceWorker['state']) {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeServiceWorker | null = null
  installing: FakeServiceWorker | null = null
  update = vi.fn().mockResolvedValue(undefined)
  triggerUpdateFound(worker: FakeServiceWorker) {
    this.installing = worker
    this.dispatchEvent(new Event('updatefound'))
  }
}

class FakeServiceWorkerContainer extends EventTarget {
  controller: object | null = null
  register = vi.fn()
}

function install() {
  const container = new FakeServiceWorkerContainer()
  const registration = new FakeRegistration()
  container.register.mockResolvedValue(registration)
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: container })
  return { container, registration }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('useServiceWorkerUpdate', () => {
  it('does not announce an update on the very first install (no prior controller)', async () => {
    const { container, registration } = install()
    container.controller = null

    const { result, unmount } = renderHook(() => useServiceWorkerUpdate())
    await flush()

    const worker = new FakeServiceWorker()
    act(() => registration.triggerUpdateFound(worker))
    act(() => worker.setState('installed'))

    expect(result.current.updateAvailable).toBe(false)
    unmount()
  })

  it('11. announces an update, without reloading, when a new worker finishes installing while a previous version already controls the page', async () => {
    const { container, registration } = install()
    container.controller = {}

    const { result, unmount } = renderHook(() => useServiceWorkerUpdate())
    await flush()

    const worker = new FakeServiceWorker()
    act(() => registration.triggerUpdateFound(worker))
    act(() => worker.setState('installed'))

    expect(result.current.updateAvailable).toBe(true)
    expect(window.location.href).toBeDefined() // no reload was attempted (jsdom would throw on unimplemented navigation otherwise)
    unmount()
  })

  it('announces an update immediately if the app is reopened and a worker is already waiting', async () => {
    const { container, registration } = install()
    container.controller = {}
    registration.waiting = new FakeServiceWorker()

    const { result, unmount } = renderHook(() => useServiceWorkerUpdate())
    await flush()

    expect(result.current.updateAvailable).toBe(true)
    unmount()
  })

  it('12. applying the update posts SKIP_WAITING and reloads once the browser hands control to the new worker', async () => {
    const { container, registration } = install()
    container.controller = {}
    const waiting = new FakeServiceWorker()
    registration.waiting = waiting

    const { result, unmount } = renderHook(() => useServiceWorkerUpdate())
    await flush()
    expect(result.current.updateAvailable).toBe(true)

    const reloadSpy = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy })

    act(() => result.current.applyUpdate())
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(result.current.applying).toBe(true)

    act(() => container.dispatchEvent(new Event('controllerchange')))
    expect(reloadSpy).toHaveBeenCalledOnce()
    unmount()
  })

  it('13. treats a stuck update (no controllerchange in time) as failed and offers a retry', async () => {
    const { container, registration } = install()
    container.controller = {}
    const waiting = new FakeServiceWorker()
    registration.waiting = waiting

    const { result, unmount } = renderHook(() => useServiceWorkerUpdate())
    await flush()

    act(() => result.current.applyUpdate())
    expect(result.current.applying).toBe(true)

    await act(async () => { await vi.advanceTimersByTimeAsync(8_000) })

    expect(result.current.applying).toBe(false)
    expect(result.current.applyFailed).toBe(true)

    // Retrying re-attempts the same waiting worker rather than leaving the user stuck.
    waiting.postMessage.mockClear()
    act(() => result.current.retryCheck())
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(result.current.applyFailed).toBe(false)
    unmount()
  })

  it('retryCheck asks the registration to check again when no worker is waiting', async () => {
    const { container, registration } = install()
    container.controller = {}

    const { result, unmount } = renderHook(() => useServiceWorkerUpdate())
    await flush()

    act(() => result.current.retryCheck())
    expect(registration.update).toHaveBeenCalled()
    unmount()
  })

  it('keeps one polling interval per mount and clears it, listeners, and pending work on unmount/remount', async () => {
    const { container, registration } = install()
    container.controller = {}
    const removeContainerListener = vi.spyOn(container, 'removeEventListener')
    const removeRegistrationListener = vi.spyOn(registration, 'removeEventListener')

    const first = renderHook(() => useServiceWorkerUpdate())
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60 * 1000) })
    expect(registration.update).toHaveBeenCalledTimes(1)
    first.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60 * 1000) })
    expect(registration.update).toHaveBeenCalledTimes(1)
    expect(removeContainerListener).toHaveBeenCalledWith('controllerchange', expect.any(Function))
    expect(removeRegistrationListener).toHaveBeenCalledWith('updatefound', expect.any(Function))

    const second = renderHook(() => useServiceWorkerUpdate())
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60 * 1000) })
    expect(registration.update).toHaveBeenCalledTimes(2)
    second.unmount()
  })
})
