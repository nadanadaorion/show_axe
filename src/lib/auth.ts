import type { Session, Subscription, User } from '@supabase/supabase-js'
import { cacheAccessToken, getSupabase } from './supabase'

/**
 * Authentication for the editor (D-215). The password is verified by Supabase Auth server-side and
 * never reaches this module; what is held here is a short-lived access token plus the refresh token
 * managed by supabase-js.
 *
 * Note what this file does *not* do: it never decides whether a mutation is allowed. Authorisation
 * lives in Postgres policies gated on `orion_is_member()`, so a client that lies to itself about its
 * session still cannot write anything. Everything here is about what the UI offers the user.
 */

const TRUSTED_DEVICE_KEY = 'orion-shows:v2-trusted-device'

export interface TrustedDevice {
  userId: string
  email: string
  trustedAt: string
}

/**
 * A device that has completed a real sign-in at least once. D-218: such a device keeps reading and
 * editing its local data when the session is gone, because signing in requires connectivity and the
 * app is used in venues without it — being locked out of an already-downloaded Show during a setup
 * is not an acceptable failure mode. Synchronisation is withheld until a session exists again.
 *
 * Signing out deliberately clears this, so an explicit logout returns to the login screen rather
 * than to the offline grace state.
 */
export function getTrustedDevice(): TrustedDevice | undefined {
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<TrustedDevice>
    if (typeof parsed.userId !== 'string' || !parsed.userId) return undefined
    return {
      userId: parsed.userId,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      trustedAt: typeof parsed.trustedAt === 'string' ? parsed.trustedAt : '',
    }
  } catch {
    return undefined
  }
}

export function rememberTrustedDevice(user: User) {
  try {
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify({
      userId: user.id,
      email: user.email || '',
      trustedAt: new Date().toISOString(),
    } satisfies TrustedDevice))
  } catch {
    // A browser refusing localStorage costs the offline grace state, not correctness.
  }
}

export function forgetTrustedDevice() {
  try {
    localStorage.removeItem(TRUSTED_DEVICE_KEY)
  } catch {
    // Ignored for the same reason.
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  cacheAccessToken(data.session?.access_token)
  return data.session
}

export interface SignInFailure {
  ok: false
  message: string
}

export type SignInResult = { ok: true; user: User } | SignInFailure

/**
 * Supabase answers a wrong password and an unknown e-mail with the same error on purpose, so the
 * screen cannot be used to discover which accounts exist. That property is preserved here: only
 * network and rate-limit conditions get a distinct message, because those are actionable.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, message: 'La conexión con Supabase no está configurada.' }

  if (!navigator.onLine) {
    return { ok: false, message: 'No hay conexión. Iniciar sesión requiere internet.' }
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      if (error.status === 429) {
        return { ok: false, message: 'Demasiados intentos. Espera un momento antes de volver a probar.' }
      }
      if (error.status === 400 || error.status === 401) {
        return { ok: false, message: 'Email o contraseña incorrectos.' }
      }
      return { ok: false, message: error.message || 'No fue posible iniciar sesión.' }
    }

    if (!data.user || !data.session) {
      return { ok: false, message: 'No fue posible iniciar sesión.' }
    }

    cacheAccessToken(data.session.access_token)
    rememberTrustedDevice(data.user)
    return { ok: true, user: data.user }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error && cause.message
        ? `No fue posible contactar al servidor: ${cause.message}`
        : 'No fue posible contactar al servidor.',
    }
  }
}

export async function signOut() {
  const supabase = getSupabase()
  forgetTrustedDevice()
  cacheAccessToken(undefined)
  if (!supabase) return
  try {
    await supabase.auth.signOut()
  } catch {
    // The local session is cleared by supabase-js regardless; a failed server round-trip must not
    // leave the user apparently signed in.
  }
}

/**
 * Changing the password of the account already signed in. This needs no SMTP and no reset route,
 * which is why it exists while forgotten-password recovery stays a dashboard operation (D-220).
 */
export async function changePassword(newPassword: string): Promise<{ ok: true } | SignInFailure> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, message: 'La conexión con Supabase no está configurada.' }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, message: error.message || 'No fue posible cambiar la contraseña.' }
  return { ok: true }
}

export function onAuthStateChange(handler: (session: Session | null) => void): Subscription | undefined {
  const supabase = getSupabase()
  if (!supabase) return undefined
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cacheAccessToken(session?.access_token)
    handler(session)
  })
  return data.subscription
}
