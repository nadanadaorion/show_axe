import { BookOpen, CalendarDays, Menu, Settings, Shapes, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from './ui'
import { SyncStatusBadge } from './SyncController'
import { branding } from '../lib/branding'

const links = [
  { to: '/shows', label: 'Shows', icon: CalendarDays },
  { to: '/library', label: 'Biblioteca', icon: BookOpen },
  { to: '/presets', label: 'Presets', icon: Shapes },
  { to: '/settings', label: 'Preferencias', icon: Settings },
]

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_1fr]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-[var(--strong-line)] bg-[var(--panel)] px-4 lg:hidden">
        <div className="text-lg font-black uppercase tracking-[-.04em]">{branding.name}</div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={20} /></Button>
      </header>

      {open && <button className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r-2 border-[var(--strong-line)] bg-[var(--panel)] transition-transform lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-auto lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="signal-rule flex h-24 items-center justify-between border-b border-dashed border-[var(--line)] px-5">
          <div>
            <div className="text-2xl font-black uppercase leading-none tracking-[-.06em]">{branding.name}</div>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-[.18em] muted">{branding.tagline}</div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={18} /></Button>
        </div>
        <nav className="flex-1 space-y-2 px-3 py-5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 border-2 px-3 py-2.5 text-xs font-bold uppercase tracking-[.08em] transition ${isActive ? 'border-[var(--strong-line)] bg-[var(--accent)] text-[var(--accent-text)] shadow-[3px_3px_0_var(--shadow-ink)]' : 'border-transparent muted hover:border-[var(--strong-line)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]'}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 border-t border-dashed border-[var(--line)] pt-3"><SyncStatusBadge /></div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-9"><div className="mx-auto max-w-[1480px]"><Outlet /></div></main>
    </div>
  )
}
