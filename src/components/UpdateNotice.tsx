import { RefreshCw } from 'lucide-react'
import { useServiceWorkerUpdate } from '../lib/useServiceWorkerUpdate'
import { Button } from './ui'

export function UpdateNotice() {
  const { updateAvailable, applying, applyFailed, applyUpdate, retryCheck } = useServiceWorkerUpdate()
  if (!updateAvailable) return null

  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-[80] flex justify-center sm:inset-x-auto sm:right-6">
      <div className="flex max-w-sm items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-xl">
        <RefreshCw size={18} className="mt-0.5 flex-none" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Hay una nueva versión disponible</p>
          <p className="mt-1 text-xs muted">
            {applyFailed
              ? 'No se pudo activar la actualización. Puedes intentarlo de nuevo.'
              : 'Tu trabajo actual no se pierde. Actualiza cuando quieras.'}
          </p>
          <div className="mt-3 flex gap-2">
            {applyFailed ? (
              <Button size="sm" variant="secondary" onClick={retryCheck}>Reintentar</Button>
            ) : (
              <Button size="sm" onClick={applyUpdate} disabled={applying}>{applying ? 'Actualizando…' : 'Actualizar ahora'}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
