import { LogIn, ShieldAlert } from 'lucide-react'
import { Button } from './ui'

/**
 * Persistent banner for the offline grace state (D-218): this device has signed in before but has
 * no live session, so local work continues while synchronisation is withheld.
 *
 * Deliberately not a Toast — Toasts auto-dismiss after five seconds, and this condition holds until
 * the user signs in again. It states the consequence for the user's data rather than the technical
 * cause, since "your changes are saved here but not shared yet" is the part that affects decisions.
 */
export function SessionNotice({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div role="status" className="warning-panel flex flex-col gap-3 border-b-2 border-[var(--strong-line)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 flex-none" size={17} />
        <p className="font-medium">
          Sesión expirada. Podés seguir trabajando: tus cambios se guardan en este dispositivo y se
          compartirán cuando vuelvas a iniciar sesión.
        </p>
      </div>
      <Button size="sm" variant="secondary" className="flex-none" onClick={onSignIn}>
        <LogIn size={14} />Iniciar sesión
      </Button>
    </div>
  )
}
