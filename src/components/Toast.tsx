/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Button } from './ui'

type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void }
type ToastApi = { showToast: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void }
const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const showToast = useCallback((message: string, options?: { actionLabel?: string; onAction?: () => void }) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, ...options }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 5000)
  }, [])
  const api = useMemo(() => ({ showToast }), [showToast])
  return <ToastContext.Provider value={api}>{children}<div className="fixed bottom-4 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">{toasts.map((toast) => <div key={toast.id} className="signal-rule flex items-center justify-between gap-3 border-2 border-[var(--strong-line)] bg-[var(--text)] px-4 py-3 text-sm font-bold text-[var(--panel)] shadow-[5px_5px_0_var(--accent)]"><span>{toast.message}</span>{toast.onAction && <Button size="sm" variant="ghost" className="border-current/20 text-inherit hover:bg-[var(--panel)] hover:text-[var(--text)]" onClick={() => { toast.onAction?.(); setToasts((current) => current.filter((item) => item.id !== toast.id)) }}>{toast.actionLabel || 'Deshacer'}</Button>}</div>)}</div></ToastContext.Provider>
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider')
  return value
}
