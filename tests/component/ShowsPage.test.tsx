import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ShowsPage from '../../src/pages/ShowsPage'
import { ToastProvider } from '../../src/components/Toast'

describe('ShowsPage', () => {
  it('has a single unambiguous "create show" affordance when the list is empty', () => {
    // Regression test: with zero Shows (a fresh shared database — exactly the state every
    // Supabase-backed E2E spec starts from), the page header's "Nuevo show" button and the empty
    // state's own call-to-action button used to share the identical accessible name, so
    // getByRole('button', { name: 'Nuevo show' }) resolved to 2 elements and every spec that
    // needed to create its first Show failed outright.
    render(
      <MemoryRouter>
        <ToastProvider>
          <ShowsPage />
        </ToastProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Nuevo show' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Nuevo show' })).toHaveLength(1)
  })
})
