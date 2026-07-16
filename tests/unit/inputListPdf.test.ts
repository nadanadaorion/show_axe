import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildEmptyShow, buildInputList, buildInputListRow, buildMonitorReturn } from '../fixtures/builders'

interface TableOptions {
  body: unknown[][]
}

interface PdfOptions {
  orientation: string
  unit: string
  format: string
}

interface FakePdfInstance {
  options: PdfOptions
  pageCount: number
  lastAutoTable?: { finalY: number }
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } }
  setFont: ReturnType<typeof vi.fn>
  setFontSize: ReturnType<typeof vi.fn>
  text: ReturnType<typeof vi.fn>
  setTextColor: ReturnType<typeof vi.fn>
  addPage: ReturnType<typeof vi.fn>
  getNumberOfPages: ReturnType<typeof vi.fn>
  setPage: ReturnType<typeof vi.fn>
  splitTextToSize: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
}

const pdfMocks = vi.hoisted(() => ({
  instances: [] as FakePdfInstance[],
  tableOptions: [] as TableOptions[],
  finalYs: [] as number[],
}))

vi.mock('jspdf', () => ({
  jsPDF: class FakePdf implements FakePdfInstance {
    options: PdfOptions
    pageCount = 1
    lastAutoTable?: { finalY: number }
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } }
    setFont = vi.fn()
    setFontSize = vi.fn()
    text = vi.fn()
    setTextColor = vi.fn()
    addPage = vi.fn(() => { this.pageCount += 1 })
    getNumberOfPages = vi.fn(() => this.pageCount)
    setPage = vi.fn()
    splitTextToSize = vi.fn((value: string) => [value])
    save = vi.fn()

    constructor(options: PdfOptions) {
      this.options = options
      pdfMocks.instances.push(this)
    }
  },
}))
vi.mock('jspdf-autotable', () => ({
  default: (doc: FakePdfInstance, options: TableOptions) => {
    pdfMocks.tableOptions.push(options)
    doc.lastAutoTable = { finalY: pdfMocks.finalYs.shift() ?? 80 }
  },
}))

import { exportInputListPdf } from '../../src/lib/inputListPdf'

describe('Input List PDF export', () => {
  beforeEach(() => {
    pdfMocks.instances.length = 0
    pdfMocks.tableOptions.length = 0
    pdfMocks.finalYs.length = 0
  })

  it('exports landscape with custom channels, row details, and mono/stereo returns without mutating the Show', () => {
    const show = buildEmptyShow({
      name: 'Festival Ágora',
      inputList: buildInputList({
        channelStart: 17,
        rows: [
          buildInputListRow({ order: 1, channel: 'CH-X', use: 'Manual', equipment: 'DI', phantom: true, patch: 'A-02', notes: 'Directa' }),
          buildInputListRow({ order: 0, channel: '17', use: 'Kick', equipment: 'Beta 52', notes: 'Atrás' }),
        ],
        returns: [
          buildMonitorReturn({ order: 1, destination: 'Voz', outputStart: 7, stereo: true }),
          buildMonitorReturn({ order: 0, destination: 'Batería', outputStart: 3, stereo: false }),
        ],
      }),
    })
    const before = structuredClone(show)

    exportInputListPdf(show, 'landscape')

    const doc = pdfMocks.instances[0]
    expect(doc.options).toEqual({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    expect(pdfMocks.tableOptions[0].body).toEqual([
      ['17', 'Kick', 'Beta 52', 'No', '-', 'Atrás'],
      ['CH-X', 'Manual', 'DI', 'Si', 'A-02', 'Directa'],
    ])
    expect(pdfMocks.tableOptions[1].body).toEqual([
      ['1', 'Batería', 'IEM', 'AUX 3', '-'],
      ['2', 'Voz', 'IEM', 'AUX 7–8', '-'],
    ])
    expect(doc.save).toHaveBeenCalledWith('festival-agora-input-list-horizontal.pdf')
    expect(show).toEqual(before)
  })

  it('exports portrait across multiple pages and numbers every generated page', () => {
    pdfMocks.finalYs.push(190, 185)
    const show = buildEmptyShow({
      name: 'Show largo',
      inputList: buildInputList({
        rows: [buildInputListRow()],
        returns: [buildMonitorReturn({ stereo: true, outputStart: 1 })],
        generalNotes: 'Notas de operación para la última página',
      }),
    })

    exportInputListPdf(show, 'portrait')

    const doc = pdfMocks.instances[0]
    expect(doc.options.orientation).toBe('portrait')
    expect(doc.addPage).toHaveBeenCalledTimes(2)
    expect(doc.pageCount).toBe(3)
    expect(doc.setPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3])
    expect(doc.text).toHaveBeenCalledWith('Pagina 1 de 3', 285, 203, { align: 'right' })
    expect(doc.text).toHaveBeenCalledWith('Pagina 3 de 3', 285, 203, { align: 'right' })
    expect(doc.save).toHaveBeenCalledWith('show-largo-input-list-vertical.pdf')
  })

  it('does nothing when the Show has no Input List', () => {
    exportInputListPdf(buildEmptyShow(), 'portrait')
    expect(pdfMocks.instances).toEqual([])
  })
})
