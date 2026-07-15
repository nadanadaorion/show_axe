import { Search, X } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

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

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-5 py-4"><h2 className="font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></Button></div>
        <div className="p-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-1 text-sm muted">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>
}
