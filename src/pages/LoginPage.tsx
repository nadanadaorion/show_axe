import { KeyRound, LoaderCircle, LogIn, WifiOff } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { signIn } from '../lib/auth'
import { branding } from '../lib/branding'
import { Button, Field, Input } from '../components/ui'

/**
 * Editor sign-in (D-215). There is deliberately no "create account" affordance: signups are
 * disabled in the Supabase project and membership is granted by an operator (D-217), so offering
 * registration here would only produce accounts that authenticate and are then denied by policy.
 */
export default function LoginPage({ onSignedIn, notice, onCancel }: { onSignedIn: () => void; notice?: string; onCancel?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!email.trim() || !password) {
      setError('Escribe tu email y tu contraseña.')
      return
    }
    setBusy(true)
    try {
      const result = await signIn(email, password)
      if (result.ok) {
        setPassword('')
        onSignedIn()
        return
      }
      setError(result.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="min-h-screen px-4 py-10 sm:px-6 lg:py-16">
    <div className="mx-auto max-w-md">
      <div className="mb-8 border-b-2 border-[var(--strong-line)] pb-6 text-center">
        <div className="text-5xl font-black uppercase leading-none tracking-[-.065em] sm:text-6xl">{branding.name}</div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[.18em] muted">{branding.tagline}</p>
      </div>

      <form onSubmit={submit} className="panel signal-rule p-6 shadow-[6px_6px_0_var(--shadow-ink)]">
        <div className="mb-5 flex h-11 w-11 items-center justify-center border-2 border-[var(--strong-line)] bg-[var(--accent)] text-white"><KeyRound size={21} /></div>
        <h1 className="text-3xl font-black uppercase tracking-[-.04em]">Iniciar sesión</h1>
        <p className="mt-2 text-sm muted">Este espacio es privado. Necesitas una cuenta autorizada para abrirlo.</p>

        {notice && <div className="mt-5 warning-panel border-2 p-3 text-xs font-medium">{notice}</div>}

        <div className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
            />
          </Field>
          <Field label="Contraseña">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </Field>

          {error && <div role="alert" className="danger-panel border-2 p-3 text-sm font-bold">{error}</div>}

          {!online && <div role="status" className="flex items-start gap-2 border-2 border-[var(--line)] bg-[var(--panel-2)] p-3 text-xs muted"><WifiOff className="mt-0.5 flex-none" size={15} />Sin conexión. Iniciar sesión requiere internet; volvé a intentarlo cuando vuelva la señal.</div>}

          <Button type="submit" className="w-full" disabled={busy || !online}>
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : <LogIn size={16} />}
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>

          {/* Only offered to a device in the offline grace state, which has local work to go back
              to. A device with no session and no history has nothing behind this screen. */}
          {onCancel && <Button type="button" variant="ghost" className="w-full" onClick={onCancel} disabled={busy}>
            Volver a mis datos locales
          </Button>}
        </div>
      </form>

      <p className="mt-5 text-center text-xs muted">
        ¿Olvidaste la contraseña? Se restablece desde el panel de Supabase, en Authentication → Users.
      </p>
    </div>
  </div>
}
