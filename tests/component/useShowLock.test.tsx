import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit-level coverage of the lock hook's local state machine (acquire,
 * heartbeat renewal, release, inactivity-driven expiry) with only our own
 * src/lib/supabase adapter functions mocked — never a claim that this proves
 * Supabase itself works. The real RPC behavior (including the ten-minute
 * server-side expiry) is proven for real in supabase/scripts/assertions.sql
 * and tests/integration/locks.test.ts.
 *
 * Uses fake timers throughout. @testing-library's `waitFor` polls with a real
 * setTimeout internally and deadlocks against paused fake timers, so state
 * changes are awaited by flushing timers/microtasks inside `act()` instead.
 */
vi.mock('../../src/lib/supabase', () => ({
  acquireRemoteLock: vi.fn(),
  releaseRemoteLock: vi.fn().mockResolvedValue(undefined),
  releaseRemoteLockKeepalive: vi.fn(),
}))
vi.mock('../../src/lib/config', () => ({ isRuntimeConfigured: vi.fn(() => true) }))

const { acquireRemoteLock, releaseRemoteLock } = await import('../../src/lib/supabase')
const { useShowLock } = await import('../../src/lib/useShowLock')

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useShowLock', () => {
  it('acquires the lock and reports status "owned"', async () => {
    vi.mocked(acquireRemoteLock).mockResolvedValue({ acquired: true, ownerClientId: undefined, deviceLabel: 'Chrome · macOS', expiresAt: '2026-01-01T00:10:00.000Z' })

    const { result, unmount } = renderHook(() => useShowLock('show-1'))
    await flush()

    expect(result.current.status).toBe('owned')
    expect(result.current.canEdit).toBe(true)
    unmount()
  })

  it('reports status "blocked" with the owning device label when another client holds the lock', async () => {
    vi.mocked(acquireRemoteLock).mockResolvedValue({ acquired: false, ownerClientId: 'other-client', deviceLabel: 'Firefox · Windows', expiresAt: undefined })

    const { result, unmount } = renderHook(() => useShowLock('show-1'))
    await flush()

    expect(result.current.status).toBe('blocked')
    expect(result.current.deviceLabel).toBe('Firefox · Windows')
    expect(result.current.canEdit).toBe(false)
    unmount()
  })

  it('renews the lock via a heartbeat roughly every 30 seconds', async () => {
    vi.mocked(acquireRemoteLock).mockResolvedValue({ acquired: true, ownerClientId: undefined, deviceLabel: 'Chrome · macOS', expiresAt: '2026-01-01T00:10:00.000Z' })

    const { unmount } = renderHook(() => useShowLock('show-1'))
    await flush()
    expect(acquireRemoteLock).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(acquireRemoteLock).toHaveBeenCalledTimes(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(acquireRemoteLock).toHaveBeenCalledTimes(3)

    unmount()
  })

  it('releases the lock when the component unmounts (leaving the Show)', async () => {
    vi.mocked(acquireRemoteLock).mockResolvedValue({ acquired: true, ownerClientId: undefined, deviceLabel: 'Chrome · macOS', expiresAt: '2026-01-01T00:10:00.000Z' })

    const { result, unmount } = renderHook(() => useShowLock('show-1'))
    await flush()
    expect(result.current.status).toBe('owned')

    unmount()
    expect(releaseRemoteLock).toHaveBeenCalledWith('show-1', expect.any(String))
  })

  it('releases and moves to "idle" after ten minutes without activity', async () => {
    vi.mocked(acquireRemoteLock).mockResolvedValue({ acquired: true, ownerClientId: undefined, deviceLabel: 'Chrome · macOS', expiresAt: '2026-01-01T00:10:00.000Z' })

    const { result, unmount } = renderHook(() => useShowLock('show-1'))
    await flush()
    expect(result.current.status).toBe('owned')

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60 * 1000) })

    expect(releaseRemoteLock).toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
    unmount()
  })

  it('does not attempt to acquire while offline, and reports status "offline"', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    const { result, unmount } = renderHook(() => useShowLock('show-1'))
    await flush()

    expect(result.current.status).toBe('offline')
    expect(acquireRemoteLock).not.toHaveBeenCalled()
    expect(result.current.canEdit).toBe(true) // offline editing remains allowed, with a risk notice in the UI
    unmount()
  })
})
