import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

/**
 * Covers the client half of D-215: what the UI is told, and what the trusted-device record does.
 *
 * It deliberately proves nothing about access control. Whether a request is allowed is decided by
 * Postgres policies gated on `orion_is_member()`, so no client-side test could establish it; that
 * boundary is exercised for real in tests/integration/auth.test.ts.
 */
const signInWithPassword = vi.fn()
const authSignOut = vi.fn().mockResolvedValue({ error: null })
const getSession = vi.fn()
const updateUser = vi.fn()
const cacheAccessToken = vi.fn()

vi.mock('../../src/lib/supabase', () => ({
  cacheAccessToken: (token: string | undefined) => cacheAccessToken(token),
  getSupabase: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signOut: () => authSignOut(),
      getSession: () => getSession(),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  }),
}))

const {
  changePassword,
  forgetTrustedDevice,
  getCurrentSession,
  getTrustedDevice,
  rememberTrustedDevice,
  signIn,
  signOut,
} = await import('../../src/lib/auth')

const user = { id: 'user-1', email: 'tecnica@ejemplo.com' } as User

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('signIn', () => {
  it('marks the device as trusted and caches the token on success', async () => {
    signInWithPassword.mockResolvedValue({ data: { user, session: { access_token: 'token-abc' } }, error: null })

    const result = await signIn(' tecnica@ejemplo.com ', 'una frase larga')

    expect(result).toEqual({ ok: true, user })
    // The e-mail is trimmed; the password is forwarded untouched, since leading or trailing
    // whitespace is a legitimate part of a passphrase.
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'tecnica@ejemplo.com', password: 'una frase larga' })
    expect(cacheAccessToken).toHaveBeenCalledWith('token-abc')
    expect(getTrustedDevice()).toMatchObject({ userId: 'user-1', email: 'tecnica@ejemplo.com' })
  })

  it('gives a wrong password and an unknown account the same message', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400, message: 'Invalid login credentials' } })
    const wrongPassword = await signIn('tecnica@ejemplo.com', 'mala')

    signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400, message: 'Invalid login credentials' } })
    const unknownAccount = await signIn('nadie@ejemplo.com', 'mala')

    expect(wrongPassword).toEqual({ ok: false, message: 'Email o contraseña incorrectos.' })
    // Identical wording is the point: the screen must not reveal which accounts exist.
    expect(unknownAccount).toEqual(wrongPassword)
  })

  it('does not trust the device when authentication fails', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400, message: 'Invalid login credentials' } })

    await signIn('tecnica@ejemplo.com', 'mala')

    expect(getTrustedDevice()).toBeUndefined()
    expect(cacheAccessToken).not.toHaveBeenCalled()
  })

  it('distinguishes rate limiting, which is actionable', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { status: 429, message: 'Too many requests' } })

    const result = await signIn('tecnica@ejemplo.com', 'mala')

    expect(result).toEqual({ ok: false, message: 'Demasiados intentos. Espera un momento antes de volver a probar.' })
  })

  it('refuses offline without a network round-trip, since signing in requires connectivity', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    const result = await signIn('tecnica@ejemplo.com', 'una frase larga')

    expect(result).toEqual({ ok: false, message: 'No hay conexión. Iniciar sesión requiere internet.' })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('reports a thrown transport failure instead of leaving the form silent', async () => {
    signInWithPassword.mockRejectedValue(new Error('Failed to fetch'))

    const result = await signIn('tecnica@ejemplo.com', 'una frase larga')

    expect(result).toEqual({ ok: false, message: 'No fue posible contactar al servidor: Failed to fetch' })
  })
})

describe('signOut', () => {
  it('clears the trusted device, so an explicit logout lands on the login screen and not on grace', async () => {
    rememberTrustedDevice(user)
    expect(getTrustedDevice()).toBeDefined()

    await signOut()

    expect(getTrustedDevice()).toBeUndefined()
    expect(cacheAccessToken).toHaveBeenCalledWith(undefined)
    expect(authSignOut).toHaveBeenCalled()
  })

  it('still clears local trust when the server round-trip throws', async () => {
    rememberTrustedDevice(user)
    authSignOut.mockRejectedValueOnce(new Error('network down'))

    await expect(signOut()).resolves.toBeUndefined()

    expect(getTrustedDevice()).toBeUndefined()
  })
})

describe('getTrustedDevice', () => {
  it('ignores a corrupted record rather than throwing on start-up', () => {
    localStorage.setItem('orion-shows:v2-trusted-device', '{not json')
    expect(getTrustedDevice()).toBeUndefined()
  })

  it('ignores a record without a user id', () => {
    localStorage.setItem('orion-shows:v2-trusted-device', JSON.stringify({ email: 'x@y.z' }))
    expect(getTrustedDevice()).toBeUndefined()
  })

  it('forgetTrustedDevice removes the record', () => {
    rememberTrustedDevice(user)
    forgetTrustedDevice()
    expect(getTrustedDevice()).toBeUndefined()
  })
})

describe('getCurrentSession', () => {
  it('caches the access token it observes, which is what the pagehide lock release reads', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-xyz', user } } })

    const session = await getCurrentSession()

    expect(session).toMatchObject({ access_token: 'token-xyz' })
    expect(cacheAccessToken).toHaveBeenCalledWith('token-xyz')
  })

  it('clears the cached token when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    expect(await getCurrentSession()).toBeNull()
    expect(cacheAccessToken).toHaveBeenCalledWith(undefined)
  })
})

describe('changePassword', () => {
  it('reports success', async () => {
    updateUser.mockResolvedValue({ error: null })
    expect(await changePassword('otra frase muy larga')).toEqual({ ok: true })
    expect(updateUser).toHaveBeenCalledWith({ password: 'otra frase muy larga' })
  })

  it('surfaces the server message on rejection', async () => {
    updateUser.mockResolvedValue({ error: { message: 'Password should be at least 6 characters' } })
    expect(await changePassword('corta')).toEqual({ ok: false, message: 'Password should be at least 6 characters' })
  })
})
