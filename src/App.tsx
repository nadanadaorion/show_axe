import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { GlobalErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary'
import { SyncController } from './components/SyncController'
import { UpdateNotice } from './components/UpdateNotice'
import { isRuntimeConfigured } from './lib/config'
import { branding } from './lib/branding'
import { useAppStore } from './store'
import ShowsPage from './pages/ShowsPage'
import SetupPage from './pages/SetupPage'

// Lazy-loaded: not needed for first paint of the (very common) Shows landing route. Vite splits
// each into its own chunk, so opening the app doesn't pay for Library/Presets/Settings/ShowPage/
// PublicShowPage code until the user actually navigates there.
const ShowPage = lazy(() => import('./pages/ShowPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const PresetsPage = lazy(() => import('./pages/PresetsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PublicShowPage = lazy(() => import('./pages/PublicShowPage'))

function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center p-8">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--text)]" />
        <p className="text-sm muted">Cargando…</p>
      </div>
    </div>
  )
}

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

  if (!ready) return <div className="flex min-h-screen items-center justify-center"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--text)]" /><p className="text-sm muted">Abriendo {branding.name}…</p></div></div>

  return <SyncController><Suspense fallback={<RouteFallback />}><Routes><Route element={<Layout />}><Route index element={<Navigate to={`/${preferences.initialModule}`} replace />} /><Route path="shows" element={<RouteErrorBoundary><ShowsPage /></RouteErrorBoundary>} /><Route path="shows/:id" element={<RouteErrorBoundary><ShowPage /></RouteErrorBoundary>} /><Route path="library" element={<RouteErrorBoundary><LibraryPage /></RouteErrorBoundary>} /><Route path="presets" element={<RouteErrorBoundary><PresetsPage /></RouteErrorBoundary>} /><Route path="settings" element={<RouteErrorBoundary><SettingsPage /></RouteErrorBoundary>} /><Route path="*" element={<Navigate to="/shows" replace />} /></Route></Routes></Suspense></SyncController>
}

function AppRoutes() {
  const location = useLocation()
  if (location.pathname.startsWith('/public/')) return <Suspense fallback={<RouteFallback />}><Routes><Route path="public/:slug" element={<RouteErrorBoundary title="Este enlace no pudo cargarse" description="Es posible que el show ya no exista o que el enlace haya cambiado."><PublicShowPage /></RouteErrorBoundary>} /><Route path="*" element={<Navigate to="/shows" replace />} /></Routes></Suspense>
  return <EditorRoutes />
}

export default function App() {
  return <GlobalErrorBoundary><ToastProvider>{isRuntimeConfigured() ? <HashRouter><AppRoutes /></HashRouter> : <SetupPage />}<UpdateNotice /></ToastProvider></GlobalErrorBoundary>
}
