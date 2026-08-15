import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentSession, getTrustedDevice, onAuthStateChange } from './auth'

/**
 * `checking`      — resolving the stored session; nothing is decided yet.
 * `authenticated` — a live session exists; the app is fully operational.
 * `grace`         — no session, but this device has signed in before (D-218). Local data stays
 *                   readable and editable; synchronisation is withheld until a session returns.
 * `anonymous`     — no session and no history on this device; the login screen is the only view.
 */
export type AuthGate = 'checking' | 'authenticated' | 'grace' | 'anonymous'

export interface AuthGateState {
  gate: AuthGate
  /** E-mail of the signed-in user, or of the last one on a device in grace. */
  email: string
  /** True while a user in grace has explicitly asked for the login screen. */
  loginRequested: boolean
  requestLogin: () => void
  cancelLogin: () => void
}

function resolveWithoutSession(): AuthGate {
  return getTrustedDevice() ? 'grace' : 'anonymous'
}

export function useAuthGate(enabled: boolean): AuthGateState {
  const [gate, setGate] = useState<AuthGate>(enabled ? 'checking' : 'anonymous')
  const [email, setEmail] = useState(() => getTrustedDevice()?.email || '')
  const [loginRequested, setLoginRequested] = useState(false)
  // Guards against the unmounted-after-await write that React StrictMode's double mount would
  // otherwise produce on the initial session lookup.
  const active = useRef(true)

  useEffect(() => {
    active.current = true
    if (!enabled) {
      setGate('anonymous')
      return () => {
        active.current = false
      }
    }

    void (async () => {
      const session = await getCurrentSession()
      if (!active.current) return
      if (session?.user) {
        setEmail(session.user.email || '')
        setGate('authenticated')
      } else {
        setGate(resolveWithoutSession())
      }
    })()

    const subscription = onAuthStateChange((session) => {
      if (!active.current) return
      if (session?.user) {
        setEmail(session.user.email || '')
        setLoginRequested(false)
        setGate('authenticated')
      } else {
        // Reached both by an explicit sign-out (which clears the trusted device, landing on
        // `anonymous`) and by a refresh that could not be completed (which keeps it, landing on
        // `grace`). The distinction is exactly what the trusted-device record is for.
        setGate(resolveWithoutSession())
      }
    })

    return () => {
      active.current = false
      subscription?.unsubscribe()
    }
  }, [enabled])

  const requestLogin = useCallback(() => setLoginRequested(true), [])
  const cancelLogin = useCallback(() => setLoginRequested(false), [])

  return { gate, email, loginRequested, requestLogin, cancelLogin }
}
