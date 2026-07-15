import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateNotice } from '../../src/components/UpdateNotice'

vi.mock('../../src/lib/useServiceWorkerUpdate', () => ({ useServiceWorkerUpdate: vi.fn() }))
const { useServiceWorkerUpdate } = await import('../../src/lib/useServiceWorkerUpdate')

describe('UpdateNotice', () => {
  it('renders nothing when there is no update available', () => {
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({ updateAvailable: false, applying: false, applyFailed: false, applyUpdate: vi.fn(), retryCheck: vi.fn() })
    render(<UpdateNotice />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('11. announces an available update with an update action, not an automatic reload', () => {
    const applyUpdate = vi.fn()
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({ updateAvailable: true, applying: false, applyFailed: false, applyUpdate, retryCheck: vi.fn() })
    render(<UpdateNotice />)
    expect(screen.getByRole('status')).toHaveTextContent('Hay una nueva versión disponible')
    const button = screen.getByRole('button', { name: 'Actualizar ahora' })
    button.click()
    expect(applyUpdate).toHaveBeenCalledOnce()
  })

  it('13. offers a retry action once an update attempt has failed', () => {
    const retryCheck = vi.fn()
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({ updateAvailable: true, applying: false, applyFailed: true, applyUpdate: vi.fn(), retryCheck })
    render(<UpdateNotice />)
    const button = screen.getByRole('button', { name: 'Reintentar' })
    button.click()
    expect(retryCheck).toHaveBeenCalledOnce()
  })
})
