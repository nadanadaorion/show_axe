import { BookOpen, CalendarDays, Menu, Settings, Shapes, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from './ui'
import { SyncStatusBadge } from './SyncController'

const links = [
  { to: '/shows', label: 'Shows', icon: CalendarDays },
  { to: '/library', label: 'Biblioteca', icon: BookOpen },
  { to: '/presets', label: 'Presets', icon: Shapes },
  { to: '/settings', label: 'Preferencias', icon: Settings },
]

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4 lg:hidden">
        <div className="font-semibold tracking-tight">Ori♡n Shows</div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={20} /></Button>
      </header>

      {open && <button className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--line)] bg-[var(--panel)] transition-transform lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-auto lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between px-5">
          <div>
            <div className="text-lg font-semibold tracking-tight">Ori♡n Shows</div>
            <div className="text-xs muted">Preparación de shows</div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={18} /></Button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted hover:bg-[var(--panel-2)] hover:text-[var(--text)]'}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3"><SyncStatusBadge /></div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-7xl"><Outlet /></div></main>
    </div>
  )
}
