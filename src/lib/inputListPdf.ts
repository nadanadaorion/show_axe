import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Show } from '../types'
import { outputLabel } from './inputList'

export type PdfOrientation = 'landscape' | 'portrait'

function safeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'show'
}

export function exportInputListPdf(show: Show, orientation: PdfOrientation) {
  if (!show.inputList) return
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 12
  const compact = orientation === 'portrait'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(compact ? 15 : 17)
  doc.text(show.name || 'Show sin nombre', margin, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const metadata = [show.date, show.time, show.showType].filter(Boolean).join('  |  ') || 'Sin fecha ni tipo de show'
  doc.text(metadata, margin, 21)
  doc.setTextColor(100)
  doc.text('Ori n Shows - Input list', pageWidth - margin, 15, { align: 'right' })
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 27,
    margin: { left: margin, right: margin },
    head: [['CH', 'Uso', 'Equipo', '48V', 'Patch', 'Notas']],
    body: show.inputList.rows
      .sort((a, b) => a.order - b.order)
      .map((row, index) => [
        row.channel || String(index + 1),
        row.use || '-',
        row.equipment || '-',
        row.phantom ? 'Si' : 'No',
        row.patch || '-',
        row.notes || '-',
      ]),
    styles: { font: 'helvetica', fontSize: compact ? 6.5 : 7.5, cellPadding: compact ? 1.4 : 1.8, overflow: 'linebreak' },
    headStyles: { fillColor: [35, 35, 35], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: compact ? 9 : 11, halign: 'center' },
      1: { cellWidth: compact ? 34 : 46 },
      2: { cellWidth: compact ? 34 : 46 },
      3: { cellWidth: compact ? 10 : 12, halign: 'center' },
      4: { cellWidth: compact ? 23 : 32 },
      5: { cellWidth: 'auto' },
    },
  })

  const lastInputY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 27
  let returnsStart = lastInputY + 8
  if (returnsStart > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage()
    returnsStart = 15
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Retornos de monitoreo', margin, returnsStart)

  autoTable(doc, {
    startY: returnsStart + 3,
    margin: { left: margin, right: margin },
    head: [['Mix', 'Destino', 'Sistema', 'Salida', 'Notas']],
    body: show.inputList.returns
      .sort((a, b) => a.order - b.order)
      .map((item, index) => [
        String(index + 1),
        item.destination || '-',
        item.system || '-',
        outputLabel(item),
        item.notes || '-',
      ]),
    styles: { font: 'helvetica', fontSize: compact ? 6.5 : 7.5, cellPadding: compact ? 1.4 : 1.8, overflow: 'linebreak' },
    headStyles: { fillColor: [35, 35, 35], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: compact ? 10 : 12, halign: 'center' },
      1: { cellWidth: compact ? 38 : 55 },
      2: { cellWidth: compact ? 34 : 48 },
      3: { cellWidth: compact ? 25 : 34 },
      4: { cellWidth: 'auto' },
    },
  })

  if (show.inputList.generalNotes?.trim()) {
    const lastReturnY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || returnsStart + 3
    const noteY = lastReturnY + 8
    const pageHeight = doc.internal.pageSize.getHeight()
    if (noteY > pageHeight - 28) doc.addPage()
    const actualY = noteY > pageHeight - 28 ? 15 : noteY
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Notas generales', margin, actualY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(show.inputList.generalNotes, pageWidth - margin * 2)
    doc.text(lines, margin, actualY + 5)
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(`Pagina ${page} de ${pages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 7, { align: 'right' })
  }
  doc.setTextColor(0)
  doc.save(`${safeFilename(show.name)}-input-list-${orientation === 'landscape' ? 'horizontal' : 'vertical'}.pdf`)
}
