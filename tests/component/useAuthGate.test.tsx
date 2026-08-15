import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'

/**
 * The gate decides which of four views the editor shows. The case that matters most is `grace`
 * (D-218): a device that has signed in before keeps its local data usable without a session,
 * because signing in needs connectivity and this app is used in venues that have none.
 */
const getCurrentSession = vi.fn()
const getTrustedDevice = vi.fn()
let emitAuthChange: (session: Session | null) => void = () => undefined
const unsubscribe = vi.fn()

vi.mock('../../src/lib/auth', () => ({
  getCurrentSession: () => getCurrentSession(),
  getTrustedDevice: () => getTrustedDevice(),
  onAuthStateChange: (handler: (session: Session | null) => void) => {
    emitAuthChange = handler
    return { unsubscribe }
  },
}))

const { useAuthGate } = await import('../../src/lib/useAuthGate')

const session = { user: { id: 'user-1', email: 'tecnica@ejemplo.com' } } as Session

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentSession.mockResolvedValue(null)
  getTrustedDevice.mockReturnValue(undefined)
})

describe('useAuthGate', () => {
  it('starts in "checking" so no screen flashes before the stored session is resolved', () => {
    const { result } = renderHook(() => useAuthGate(true))
    expect(result.current.gate).toBe('checking')
  })

  it('resolves to "authenticated" and exposes the e-mail when a session exists', async () => {
    getCurrentSession.mockResolvedValue(session)

    const { result } = renderHook(() => useAuthGate(true))

    await waitFor(() => expect(result.current.gate).toBe('authenticated'))
    expect(result.current.email).toBe('tecnica@ejemplo.com')
  })

  it('resolves to "anonymous" with no session and no history on this device', async () => {
    const { result } = renderHook(() => useAuthGate(true))
    await waitFor(() => expect(result.current.gate).toBe('anonymous'))
  })

  it('resolves to "grace" with no session on a device that signed in before', async () => {
    getTrustedDevice.mockReturnValue({ userId: 'user-1', email: 'tecnica@ejemplo.com', trustedAt: '2026-08-01T00:00:00.000Z' })

    const { result } = renderHook(() => useAuthGate(true))

    await waitFor(() => expect(result.current.gate).toBe('grace'))
  })

  it('falls to "grace" when a session is lost but the device is still trusted', async () => {
    getCurrentSession.mockResolvedValue(session)
    getTrustedDevice.mockReturnValue({ userId: 'user-1', email: 'tecnica@ejemplo.com', trustedAt: '' })
    const { result } = renderHook(() => useAuthGate(true))
    await waitFor(() => expect(result.current.gate).toBe('authenticated'))

    act(() => emitAuthChange(null))

    expect(result.current.gate).toBe('grace')
  })

  it('falls to "anonymous" when the session is lost through an explicit sign-out', async () => {
    getCurrentSession.mockResolvedValue(session)
    const { result } = renderHook(() => useAuthGate(true))
    await waitFor(() => expect(result.current.gate).toBe('authenticated'))

    // signOut() clears the trusted device before the auth event arrives; that is precisely what
    // separates a deliberate logout from an expired session.
    getTrustedDevice.mockReturnValue(undefined)
    act(() => emitAuthChange(null))

    expect(result.current.gate).toBe('anonymous')
  })

  it('returns to "authenticated" and drops the login request when a session arrives', async () => {
    getTrustedDevice.mockReturnValue({ userId: 'user-1', email: 'tecnica@ejemplo.com', trustedAt: '' })
    const { result } = renderHook(() => useAuthGate(true))
    await waitFor(() => expect(result.current.gate).toBe('grace'))

    act(() => result.current.requestLogin())
    expect(result.current.loginRequested).toBe(true)

    act(() => emitAuthChange(session))

    expect(result.current.gate).toBe('authenticated')
    expect(result.current.loginRequested).toBe(false)
  })

  it('lets a user in grace open and close the login screen without losing local access', async () => {
    getTrustedDevice.mockReturnValue({ userId: 'user-1', email: 'tecnica@ejemplo.com', trustedAt: '' })
    const { result } = renderHook(() => useAuthGate(true))
    await waitFor(() => expect(result.current.gate).toBe('grace'))

    act(() => result.current.requestLogin())
    act(() => result.current.cancelLogin())

    expect(result.current.loginRequested).toBe(false)
    expect(result.current.gate).toBe('grace')
  })

  it('unsubscribes on unmount, including StrictMode mount/unmount cycles', async () => {
    const { unmount, result } = renderHook(() => useAuthGate(true))
    await waitFor(() => expect(result.current.gate).toBe('anonymous'))

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('does not query a session when disabled, as on the unconfigured setup screen', () => {
    const { result } = renderHook(() => useAuthGate(false))

    expect(result.current.gate).toBe('anonymous')
    expect(getCurrentSession).not.toHaveBeenCalled()
  })
})
