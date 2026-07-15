import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Button, Field, Input, Modal } from '../../src/components/ui'

// Modal portals into #modal-root and marks #root inert; the app's index.html provides both, so
// tests need the same fixture elements present in jsdom's document.
beforeEach(() => {
  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.id = 'root'
  const modalRoot = document.createElement('div')
  modalRoot.id = 'modal-root'
  document.body.append(root, modalRoot)
})

function SampleModal({ closeOnEscape = true, onClose = vi.fn() }: { closeOnEscape?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <div id="app">
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Modal
        open={open}
        title="Título de prueba"
        closeOnEscape={closeOnEscape}
        onClose={() => {
          onClose()
          if (closeOnEscape) setOpen(false)
        }}
        footer={<Button onClick={() => setOpen(false)}>Aceptar</Button>}
      >
        <Field label="Nombre">
          <Input placeholder="Escribe aquí" />
        </Field>
      </Modal>
    </div>
  )
}

describe('Modal accessibility', () => {
  it('1. renders with dialog role, an accessible name, and moves focus inside on open', () => {
    render(<SampleModal />, { container: document.getElementById('root')! })
    const dialog = screen.getByRole('dialog', { name: 'Título de prueba' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('2. traps focus: Tab from the last element cycles to the first, Shift+Tab from the first cycles to the last', async () => {
    const user = userEvent.setup()
    render(<SampleModal />, { container: document.getElementById('root')! })
    const closeButton = screen.getByRole('button', { name: 'Cerrar' })
    const input = screen.getByPlaceholderText('Escribe aquí')
    const acceptButton = screen.getByRole('button', { name: 'Aceptar' })

    closeButton.focus()
    await user.tab()
    expect(input).toHaveFocus()
    await user.tab()
    expect(acceptButton).toHaveFocus()
    await user.tab()
    expect(closeButton).toHaveFocus()

    await user.tab({ shift: true })
    expect(acceptButton).toHaveFocus()
  })

  it('3. restores focus to the trigger element on close', async () => {
    const user = userEvent.setup()
    function Wrapper() {
      const [open, setOpen] = useState(false)
      return <div>
        <button onClick={() => setOpen(true)}>Abrir modal</button>
        <Modal open={open} title="Título" onClose={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Cerrar acción</Button>}>
          contenido
        </Modal>
      </div>
    }
    render(<Wrapper />, { container: document.getElementById('root')! })
    const trigger = screen.getByRole('button', { name: 'Abrir modal' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar acción' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('restores the exact trigger after Escape, after the portal has unmounted and inert is removed', async () => {
    const user = userEvent.setup()
    function Wrapper() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Disparador exacto</button><button>Otro control</button><Modal open={open} title="Escape" onClose={() => setOpen(false)}>contenido</Modal></>
    }
    render(<Wrapper />, { container: document.getElementById('root')! })
    const trigger = screen.getByRole('button', { name: 'Disparador exacto' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.getElementById('root')).not.toHaveAttribute('inert')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('restores the pointer trigger when touch activation did not focus it before opening', async () => {
    function Wrapper() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Disparador táctil</button><Modal open={open} title="Touch" onClose={() => setOpen(false)}>contenido</Modal></>
    }
    render(<Wrapper />, { container: document.getElementById('root')! })
    const trigger = screen.getByRole('button', { name: 'Disparador táctil' })
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    expect(trigger).not.toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('4. Escape closes a cancelable modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SampleModal onClose={onClose} />, { container: document.getElementById('root')! })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('4b. Escape does not close a non-cancelable modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SampleModal closeOnEscape={false} onClose={onClose} />, { container: document.getElementById('root')! })
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('marks the app root inert while open, and removes it again once closed', async () => {
    const user = userEvent.setup()
    render(<SampleModal />, { container: document.getElementById('root')! })
    const appRoot = document.getElementById('root')!
    expect(appRoot.hasAttribute('inert')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(appRoot.hasAttribute('inert')).toBe(false)
  })
})

describe('Field label association', () => {
  it('5. associates the label with its field via id/htmlFor', () => {
    render(
      <Field label="Correo electrónico">
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
  })

  it('generates a unique id per instance, even for repeated fields', () => {
    render(
      <>
        <Field label="Nombre"><Input /></Field>
        <Field label="Nombre"><Input /></Field>
      </>,
    )
    const inputs = screen.getAllByLabelText('Nombre')
    expect(inputs).toHaveLength(2)
    expect(inputs[0]).not.toBe(inputs[1])
  })
})
