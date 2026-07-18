import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Download, RefreshCw, RotateCcw } from 'lucide-react'
import { useAppStore } from '../store'
import { downloadJson } from '../lib/utils'
import { Button } from './ui'

type Props = {
  children: ReactNode
  onPrimaryAction: () => void
  primaryActionLabel?: string
  title?: string
  description?: string
  /** Only the global/top-level boundary should offer this — see docs/24-CURRENT_IMPLEMENTATION_AUDIT.md. */
  showExportBackup?: boolean
}
type State = { error: Error | null; exportFailed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, exportFailed: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Technical details stay in the dev console; the UI below never shows a raw stack trace or
    // error message to the user (see Milestone 3 decision on ambiguity #1).
    console.error('Error no controlado en Ori♡n Shows', error, info)
  }

  private retry = () => this.setState({ error: null, exportFailed: false })

  private exportBackup = () => {
    try {
      const data = useAppStore.getState().snapshot()
      downloadJson(`orion-shows-respaldo-emergencia-${new Date().toISOString().slice(0, 10)}.json`, data)
      this.setState({ exportFailed: false })
    } catch (error) {
      console.error('No fue posible exportar el respaldo de emergencia', error)
      this.setState({ exportFailed: true })
    }
  }

  render() {
    const { error, exportFailed } = this.state
    if (!error) return this.props.children
    const { onPrimaryAction, primaryActionLabel = 'Volver a Shows', showExportBackup, title = 'La pantalla no pudo cargarse', description = 'Ocurrió un problema inesperado. Tus datos siguen guardados en este dispositivo.' } = this.props

    return (
      <div className="flex min-h-64 items-center justify-center p-5">
        <div className="panel signal-rule w-full max-w-xl p-6 text-center shadow-[6px_6px_0_var(--shadow-ink)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border-2 border-[var(--strong-line)] bg-[var(--panel-2)] text-[var(--accent)]">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-[-.035em]">{title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm muted">{description}</p>
          {exportFailed && <p role="alert" className="mx-auto mt-3 max-w-md text-sm text-red-700 dark:text-red-300">No se pudo generar el respaldo. Tus datos locales no se modificaron.</p>}
          {import.meta.env.DEV && (
            <details className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-left text-xs muted">
              <summary className="cursor-pointer font-medium text-[var(--text)]">Detalles técnicos (solo en desarrollo)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
            </details>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" onClick={this.retry}><RotateCcw size={16} />Reintentar</Button>
            <Button variant="secondary" onClick={onPrimaryAction}>{primaryActionLabel}</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}><RefreshCw size={16} />Recargar aplicación</Button>
            {showExportBackup && <Button onClick={this.exportBackup}><Download size={16} />Exportar respaldo</Button>}
          </div>
        </div>
      </div>
    )
  }
}

/** Route-level boundaries live inside the Router, so they can navigate back to Shows in-app instead of reloading. */
export function RouteErrorBoundary({ children, title, description }: { children: ReactNode; title?: string; description?: string }) {
  const navigate = useNavigate()
  return <ErrorBoundary onPrimaryAction={() => navigate('/shows')} title={title} description={description}>{children}</ErrorBoundary>
}

function fallbackToShows() {
  if (window.location.hash !== '#/shows') window.location.hash = '#/shows'
  window.location.reload()
}

/** Sits outside the Router (wraps SetupPage and the conditional HashRouter itself), so it cannot use useNavigate. */
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary onPrimaryAction={fallbackToShows} showExportBackup>
      {children}
    </ErrorBoundary>
  )
}
