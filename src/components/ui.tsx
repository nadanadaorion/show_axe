import { Search, X } from 'lucide-react'
import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'icon' }) {
  const variants = {
    primary: 'bg-[var(--accent)] text-[var(--accent-text)] border-transparent hover:opacity-85',
    secondary: 'bg-[var(--panel)] text-[var(--text)] border-[var(--line)] hover:bg-[var(--panel-2)]',
    ghost: 'bg-transparent text-[var(--text)] border-transparent hover:bg-[var(--panel-2)]',
    danger: 'bg-transparent text-[var(--danger)] border-[var(--line)] hover:bg-[var(--panel-2)]',
  }
  const sizes = { sm: 'h-8 px-3 text-xs rounded-lg', md: 'h-10 px-4 text-sm rounded-xl', icon: 'h-9 w-9 rounded-lg p-0' }
  return <button className={`inline-flex items-center justify-center gap-2 border font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`field min-h-24 resize-y ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`field ${className}`} {...props}>{children}</select>
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide muted">{children}</label>
}

/**
 * Associates a label with its field via a generated id/htmlFor pair (`useId` keeps it unique even
 * inside a .map() of repeated rows, avoiding hand-wired ids). Prefer this over the bare
 * Label+Input/Select/Textarea pair used elsewhere in the app, which has no programmatic
 * association (docs/24-CURRENT_IMPLEMENTATION_AUDIT.md "Form label association").
 */
export function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId()
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide muted">{label}</label>{isValidElement(children) ? cloneElement(children, { id }) : children}</div>
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 muted" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9 pr-9" />
      {value && <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 muted hover:bg-[var(--panel-2)]"><X size={14} /></button>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  const classes = tone === 'success' ? 'text-[var(--success)]' : tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'muted'
  return <span className={`inline-flex rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2 py-0.5 text-[11px] font-medium ${classes}`}>{children}</span>
}

export function ProgressBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value))
  return <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${safe}%` }} /></div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="panel flex min-h-56 flex-col items-center justify-center p-8 text-center"><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm muted">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
}

function canRestoreFocus(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[inert]')) return false
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false
  if ('disabled' in element && Boolean((element as HTMLButtonElement).disabled)) return false
  return element.tabIndex >= 0
}

// Tracks how many Modal instances are simultaneously open=true app-wide. Only one modal should
// ever be interactable at once (docs/06-UX_AND_INTERACTION.md); this cannot safely auto-close a
// sibling modal it doesn't own, but it surfaces the bug loudly in development instead of letting
// two focus traps silently fight each other.
let openModalCount = 0

/**
 * Accessible dialog: rendered in a portal outside #root (so `inert`-ing the app root while open
 * cannot also disable the modal itself), labelled by its title, focus-trapped, focuses into
 * itself on open and restores focus to the trigger on close. Pass `closeOnEscape={false}` for a
 * non-cancelable modal (e.g. a conflict the user must resolve via its own actions) — Escape and
 * backdrop clicks are only wired to `onClose` when the modal is actually cancelable.
 */
export function Modal({ open, title, onClose, children, footer, closeOnEscape = true }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; closeOnEscape?: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    openModalCount += 1
    if (openModalCount > 1 && import.meta.env.DEV) {
      console.warn(`[Modal] ${openModalCount} modals are open simultaneously — only one should be interactable at a time.`)
    }
    return () => {
      openModalCount -= 1
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const appRoot = document.getElementById('root')
    appRoot?.setAttribute('inert', '')

    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) {
      const [first] = getFocusable(dialog)
      ;(first || dialog).focus()
    }

    return () => {
      appRoot?.removeAttribute('inert')
      const target = previouslyFocused.current
      // Passive-effect cleanup can run before React has removed the portal DOM in a real browser.
      // Restore on the next frame, after the dialog is gone and the background is interactive.
      window.requestAnimationFrame(() => {
        if (target && canRestoreFocus(target)) target.focus()
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeOnEscape) onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      const focusable = dialog ? getFocusable(dialog) : []
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeOnEscape, onClose])

  if (!open) return null
  const portalTarget = document.getElementById('modal-root')
  const modal = (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target && closeOnEscape) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl outline-none sm:max-w-xl sm:rounded-2xl">
        <div className="flex flex-none items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-5 py-4"><h2 id={titleId} className="font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></Button></div>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-none justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
  return portalTarget ? createPortal(modal, portalTarget) : modal
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-1 text-sm muted">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>
}
