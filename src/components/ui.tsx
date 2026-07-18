import { Search, X } from 'lucide-react'
import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'icon' }) {
  const variants = {
    primary: 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--strong-line)] shadow-[3px_3px_0_var(--shadow-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--shadow-ink)]',
    secondary: 'bg-[var(--panel)] text-[var(--text)] border-[var(--strong-line)] hover:bg-[var(--text)] hover:text-[var(--panel)]',
    ghost: 'bg-transparent text-[var(--text)] border-transparent hover:border-[var(--line)] hover:bg-[var(--panel-2)]',
    danger: 'bg-transparent text-[var(--danger)] border-[var(--danger)] hover:bg-[var(--danger)] hover:text-white',
  }
  const sizes = { sm: 'h-8 px-3 text-[11px] rounded-sm', md: 'h-11 px-4 text-xs rounded-sm', icon: 'h-11 w-11 rounded-sm p-0 sm:h-10 sm:w-10' }
  return <button className={`inline-flex items-center justify-center gap-2 border-2 font-bold uppercase tracking-[.09em] transition disabled:cursor-not-allowed disabled:bg-[linear-gradient(135deg,transparent_0_45%,var(--line)_45%_55%,transparent_55%)] disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
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
  return <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[.16em] muted">{children}</label>
}

/**
 * Associates a label with its field via a generated id/htmlFor pair (`useId` keeps it unique even
 * inside a .map() of repeated rows, avoiding hand-wired ids). Prefer this over the bare
 * Label+Input/Select/Textarea pair used elsewhere in the app, which has no programmatic
 * association (docs/24-CURRENT_IMPLEMENTATION_AUDIT.md "Form label association").
 */
export function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId()
  return <div><label htmlFor={id} className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[.16em] muted">{label}</label>{isValidElement(children) ? cloneElement(children, { id }) : children}</div>
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--accent)]" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9 pr-9" />
      {value && <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 muted hover:bg-[var(--panel-2)]"><X size={14} /></button>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  const classes = tone === 'success' ? 'text-[var(--success)]' : tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'muted'
  return <span className={`inline-flex border border-[var(--strong-line)] bg-[var(--panel-2)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[.08em] ${classes}`}>{children}</span>
}

export function ProgressBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value))
  return <div className="h-2 overflow-hidden border border-[var(--strong-line)] bg-[var(--panel-2)]"><div className="h-full bg-[repeating-linear-gradient(135deg,var(--accent)_0_5px,#fff_5px_7px)] transition-all" style={{ width: `${safe}%` }} /></div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="panel signal-rule flex min-h-56 flex-col items-center justify-center overflow-hidden p-8 text-center shadow-[5px_5px_0_var(--shadow-ink)]"><div className="mb-4 h-8 w-8 border-2 border-[var(--accent)] bg-[radial-gradient(var(--accent)_1px,transparent_1px)] [background-size:4px_4px]" aria-hidden="true" /><h3 className="text-xl font-extrabold uppercase tracking-tight">{title}</h3><p className="mt-2 max-w-md text-sm muted">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
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
  const lastPointerTrigger = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) return
    const rememberPointerTrigger = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      lastPointerTrigger.current = event.target.closest<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    }
    document.addEventListener('pointerdown', rememberPointerTrigger, true)
    return () => document.removeEventListener('pointerdown', rememberPointerTrigger, true)
  }, [open])

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
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const pointerTrigger = lastPointerTrigger.current
    // Touch Chromium does not necessarily focus a tapped button. The captured pointer control is
    // therefore the exact opener when it is still usable; keyboard activation falls back to the
    // actual active element.
    previouslyFocused.current = pointerTrigger && canRestoreFocus(pointerTrigger) ? pointerTrigger : activeElement
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-grayscale sm:items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target && closeOnEscape) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="signal-rule flex max-h-[92vh] w-full flex-col overflow-hidden border-2 border-[var(--strong-line)] bg-[var(--panel)] shadow-[7px_7px_0_var(--shadow-ink)] outline-none sm:max-w-xl">
        <div className="flex flex-none items-center justify-between border-b-2 border-[var(--strong-line)] bg-[var(--panel-2)] px-5 py-4"><h2 id={titleId} className="text-lg font-extrabold uppercase tracking-tight">{title}</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></Button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="relative z-10 flex flex-none justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
  return portalTarget ? createPortal(modal, portalTarget) : modal
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-5 border-b-2 border-[var(--strong-line)] pb-5 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><h1 className="text-4xl font-black uppercase leading-[.88] tracking-[-.045em] sm:text-6xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm font-medium muted">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>
}
