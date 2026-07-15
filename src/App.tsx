import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SyncController } from './components/SyncController'
import { isRuntimeConfigured } from './lib/config'
import { useAppStore } from './store'
import ShowsPage from './pages/ShowsPage'
import ShowPage from './pages/ShowPage'
import LibraryPage from './pages/LibraryPage'
import PresetsPage from './pages/PresetsPage'
import SettingsPage from './pages/SettingsPage'
import PublicShowPage from './pages/PublicShowPage'
import SetupPage from './pages/SetupPage'

function EditorRoutes() {
  const ready = useAppStore((state) => state.ready)
  const initialize = useAppStore((state) => state.initialize)
  const preferences = useAppStore((state) => state.preferences)

  useEffect(() => { void initialize() }, [initialize])
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', preferences.theme === 'dark' || (preferences.theme === 'system' && query.matches))
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [preferences.theme])

  if (!ready) return <div className="flex min-h-screen items-center justify-center"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--text)]" /><p className="text-sm muted">Abriendo Ori♡n Shows…</p></div></div>

  return <SyncController><Routes><Route element={<Layout />}><Route index element={<Navigate to={`/${preferences.initialModule}`} replace />} /><Route path="shows" element={<ShowsPage />} /><Route path="shows/:id" element={<ShowPage />} /><Route path="library" element={<LibraryPage />} /><Route path="presets" element={<PresetsPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/shows" replace />} /></Route></Routes></SyncController>
}

function AppRoutes() {
  const location = useLocation()
  if (location.pathname.startsWith('/public/')) return <Routes><Route path="public/:slug" element={<PublicShowPage />} /><Route path="*" element={<Navigate to="/shows" replace />} /></Routes>
  return <EditorRoutes />
}

export default function App() {
  return <ErrorBoundary><ToastProvider>{isRuntimeConfigured() ? <HashRouter><AppRoutes /></HashRouter> : <SetupPage />}</ToastProvider></ErrorBoundary>
}
