import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lazy, Suspense } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, GlobalErrorBoundary, RouteErrorBoundary } from '../../src/components/ErrorBoundary'
import { useAppStore } from '../../src/store'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary onPrimaryAction={vi.fn()}>
        <div>All good</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('14. shows recovery UI instead of a black screen after a render error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary onPrimaryAction={vi.fn()}>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByText('La pantalla no pudo cargarse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a Shows' })).toBeInTheDocument()
  })

  it('never shows the raw error message or stack trace to the user (production build)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('DEV', false)
    render(
      <ErrorBoundary onPrimaryAction={vi.fn()}>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    expect(screen.queryByText(/Detalles técnicos/)).not.toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('reloads the application from the recovery action', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })

    render(
      <ErrorBoundary onPrimaryAction={vi.fn()}>
        <Bomb />
      </ErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: /recargar aplicación/i }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('15. "Reintentar" re-renders the children instead of forcing a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('boom')
      return <div>Recovered</div>
    }
    render(
      <ErrorBoundary onPrimaryAction={vi.fn()}>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByText('La pantalla no pudo cargarse')).toBeInTheDocument()
    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('calls the primary action (e.g. navigate back to Shows) from the recovery screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onPrimaryAction = vi.fn()
    render(
      <ErrorBoundary onPrimaryAction={onPrimaryAction} primaryActionLabel="Volver a Shows">
        <Bomb />
      </ErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Volver a Shows' }))
    expect(onPrimaryAction).toHaveBeenCalledOnce()
  })

  it('only offers "Exportar respaldo" when explicitly enabled (the global boundary)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary onPrimaryAction={vi.fn()}>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.queryByRole('button', { name: /exportar respaldo/i })).not.toBeInTheDocument()

    rerender(
      <ErrorBoundary onPrimaryAction={vi.fn()} showExportBackup>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /exportar respaldo/i })).toBeInTheDocument()
  })

  it('a failed backup export shows an understandable message and keeps recovery actions available, without deleting data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(useAppStore, 'getState').mockReturnValue({
      snapshot: () => { throw new Error('IndexedDB read failed') },
    } as unknown as ReturnType<typeof useAppStore.getState>)

    render(
      <ErrorBoundary onPrimaryAction={vi.fn()} showExportBackup>
        <Bomb />
      </ErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: /exportar respaldo/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo generar el respaldo')
    expect(screen.getByRole('button', { name: 'Volver a Shows' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recargar aplicación/i })).toBeInTheDocument()
  })
})

describe('RouteErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('16. "Volver a Shows" navigates in-app via React Router instead of a full reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/library']}>
        <Routes>
          <Route path="/library" element={<RouteErrorBoundary><Bomb /></RouteErrorBoundary>} />
          <Route path="/shows" element={<div>Shows landing</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('La pantalla no pudo cargarse')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a Shows' }))
    expect(screen.getByText('Shows landing')).toBeInTheDocument()
  })

  it('does not offer "Exportar respaldo" (only the global boundary does)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <MemoryRouter>
        <RouteErrorBoundary><Bomb /></RouteErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: /exportar respaldo/i })).not.toBeInTheDocument()
  })

  it('turns a rejected lazy-route import into route recovery instead of a black screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('DEV', false)
    const BrokenLazyRoute = lazy(() => Promise.reject(new Error('chunk download failed')))
    render(
      <MemoryRouter initialEntries={['/library']}>
        <Suspense fallback={<div role="status">Cargando ruta…</div>}>
          <RouteErrorBoundary><BrokenLazyRoute /></RouteErrorBoundary>
        </Suspense>
      </MemoryRouter>,
    )
    expect(await screen.findByText('La pantalla no pudo cargarse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('chunk download failed')).not.toBeInTheDocument()
    vi.unstubAllEnvs()
  })
})

describe('GlobalErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('17. falls back to a full reload at the "#/shows" route when no Router is available, and offers a backup export', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, hash: '#/library', reload },
    })

    render(
      <GlobalErrorBoundary>
        <Bomb />
      </GlobalErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /exportar respaldo/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a Shows' }))
    expect(window.location.hash).toBe('#/shows')
    expect(reload).toHaveBeenCalledOnce()
  })
})
