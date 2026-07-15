import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputListModal } from '../../src/components/InputListModal'
import { ToastProvider } from '../../src/components/Toast'
import { useAppStore } from '../../src/store'

vi.mock('../../src/lib/inputListPdf', () => ({ exportInputListPdf: vi.fn() }))

beforeEach(() => {
  useAppStore.setState({
    shows: [],
    library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderModal() {
  const { createShow, addEquipment } = useAppStore.getState()
  const showId = createShow({ name: 'PDF test show' })
  addEquipment(showId, { name: 'SM58' })
  const show = useAppStore.getState().shows.find((item) => item.id === showId)!
  render(
    <ToastProvider>
      <InputListModal open show={show} onClose={vi.fn()} />
    </ToastProvider>,
  )
  return show
}

describe('Input List PDF export', () => {
  it('17. loads the PDF module on demand and generates the export with the selected orientation', async () => {
    const { exportInputListPdf } = await import('../../src/lib/inputListPdf')
    const user = userEvent.setup()
    const show = renderModal()

    await user.click(screen.getByRole('button', { name: /exportar pdf/i }))
    expect(exportInputListPdf).toHaveBeenCalledWith(show, 'landscape')
  })

  it('shows a loading state while the export is in progress', async () => {
    const { exportInputListPdf } = await import('../../src/lib/inputListPdf')
    let resolveExport: () => void = () => {}
    vi.mocked(exportInputListPdf).mockImplementation(() => new Promise<void>((resolve) => { resolveExport = resolve }) as unknown as void)
    const user = userEvent.setup()
    renderModal()

    const button = screen.getByRole('button', { name: /exportar pdf/i })
    await user.click(button)
    expect(await screen.findByRole('button', { name: /generando/i })).toBeDisabled()

    resolveExport()
    await screen.findByRole('button', { name: /exportar pdf/i })
  })

  it('18. a PDF generation failure shows a controlled error instead of crashing, and the button recovers', async () => {
    const { exportInputListPdf } = await import('../../src/lib/inputListPdf')
    vi.mocked(exportInputListPdf).mockImplementation(() => { throw new Error('jsPDF exploded') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: /exportar pdf/i }))

    expect(await screen.findByText('No se pudo generar el PDF. Intenta de nuevo.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /exportar pdf/i })).toBeEnabled()
  })
})
