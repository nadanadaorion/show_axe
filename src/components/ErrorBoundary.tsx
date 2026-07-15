import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en Ori♡n Shows', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center p-5">
        <div className="panel w-full max-w-xl p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--panel-2)]">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-xl font-semibold">La pantalla no pudo cargarse</h1>
          <p className="mx-auto mt-2 max-w-md text-sm muted">
            Tus datos permanecen guardados. Recarga la aplicación para intentar abrirla de nuevo.
          </p>
          <details className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-left text-xs muted">
            <summary className="cursor-pointer font-medium text-[var(--text)]">Detalles técnicos</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
          </details>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />Recargar aplicación
          </Button>
        </div>
      </div>
    )
  }
}
