import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShowPage from '../../src/pages/ShowPage'
import { useAppStore } from '../../src/store'
import { ToastProvider } from '../../src/components/Toast'

// useShowLock talks to Supabase when configured; treating the runtime as unconfigured keeps the
// lock in its "offline" status (canEdit === true) without any network access, matching how these
// pages behave for the many users who never set up a shared Supabase instance.
vi.mock('../../src/lib/config', () => ({ isRuntimeConfigured: vi.fn(() => false) }))

function renderShow(showId: string) {
  return render(
    <MemoryRouter initialEntries={[`/shows/${showId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/shows/:id" element={<ShowPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAppStore.setState({
    shows: [],
    library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] },
  })
})

describe('Equipment keyboard reordering (no drag & drop required)', () => {
  it('6. moves an item up/down via accessible controls, disables at the boundaries, and gives feedback', async () => {
    const user = userEvent.setup()
    const { createShow, addEquipment } = useAppStore.getState()
    const showId = createShow({ name: 'Show de prueba' })
    addEquipment(showId, { name: 'Item 1' })
    addEquipment(showId, { name: 'Item 2' })
    addEquipment(showId, { name: 'Item 3' })

    renderShow(showId)
    await screen.findByText(/Item 1$/)

    expect(screen.getByRole('button', { name: 'Subir Item 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar Item 3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar Item 1' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Bajar Item 1' }))

    const namesAfter = useAppStore
      .getState()
      .shows.find((show) => show.id === showId)!
      .equipment.sort((a, b) => a.order - b.order)
      .map((item) => item.name)
    expect(namesAfter).toEqual(['Item 2', 'Item 1', 'Item 3'])
    expect(await screen.findByText('Equipo movido')).toBeInTheDocument()
  })

  it('7. moves an item to a different category through an accessible control, without a drag event', async () => {
    const user = userEvent.setup()
    const { createShow, addShowCategory, addEquipment } = useAppStore.getState()
    const showId = createShow({ name: 'Show de prueba' })
    const catAId = addShowCategory(showId, 'Cat A')
    addShowCategory(showId, 'Cat B')
    addEquipment(showId, { name: 'Widget', categoryId: catAId })

    renderShow(showId)
    await screen.findByText(/Widget$/)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const select = await screen.findByLabelText('Mover a categoría')
    await user.selectOptions(select, 'Cat B')

    const item = useAppStore.getState().shows.find((show) => show.id === showId)!.equipment[0]
    const catB = useAppStore.getState().shows.find((show) => show.id === showId)!.equipmentCategories.find((c) => c.name === 'Cat B')!
    expect(item.categoryId).toBe(catB.id)
    expect(await screen.findByText('Movido a "Cat B"')).toBeInTheDocument()
  })

  it('preserves the existing drag-and-drop affordance alongside the new keyboard controls', async () => {
    const { createShow, addEquipment } = useAppStore.getState()
    const showId = createShow({ name: 'Show de prueba' })
    addEquipment(showId, { name: 'Item 1' })

    renderShow(showId)
    const row = (await screen.findByText(/Item 1$/)).closest('[draggable]')
    expect(row).not.toBeNull()
    expect(row).toHaveAttribute('draggable', 'true')
  })
})
