import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Hash,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../store'
import type { InputListConfig, InputListRow, MonitorReturn, Show } from '../types'
import { createInputList, nextInputChannel, nextReturnOutput, outputLabel, previewInputListSync, renumberInputRows } from '../lib/inputList'
import type { PdfOrientation } from '../lib/inputListPdf'
import { now, uid } from '../lib/utils'
import { Badge, Button, Input, Label, Modal, Select, Textarea } from './ui'
import { useToast } from './Toast'

export function InputListModal({ open, show, onClose }: { open: boolean; show: Show; onClose: () => void }) {
  const updateShow = useAppStore((state) => state.updateShow)
  const { showToast } = useToast()
  const [syncOpen, setSyncOpen] = useState(false)
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('landscape')
  const config = show.inputList || createInputList(show)
  const rows = useMemo(() => [...config.rows].sort((a, b) => a.order - b.order), [config.rows])
  const returns = useMemo(() => [...config.returns].sort((a, b) => a.order - b.order), [config.returns])
  const syncPreview = useMemo(() => previewInputListSync(show), [show])

  if (!open) return null

  const save = (next: InputListConfig) => updateShow(show.id, { inputList: { ...next, updatedAt: now() } })
  const updateRow = (id: string, patch: Partial<InputListRow>) =>
    save({ ...config, rows: rows.map((row) => (row.id === id ? { ...row, ...patch, id: row.id } : row)) })
  const moveRow = (id: string, direction: -1 | 1) => {
    const index = rows.findIndex((row) => row.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    save({ ...config, rows: next.map((row, order) => ({ ...row, order })) })
  }
  const deleteRow = (id: string) =>
    save({ ...config, rows: rows.filter((row) => row.id !== id).map((row, order) => ({ ...row, order })) })
  const addRow = () =>
    save({
      ...config,
      rows: [
        ...rows,
        { id: uid(), order: rows.length, channel: String(nextInputChannel(rows, config.channelStart)), use: '', equipment: '', phantom: false, patch: '', notes: '' },
      ],
    })

  const updateReturn = (id: string, patch: Partial<MonitorReturn>) =>
    save({ ...config, returns: returns.map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)) })
  const moveReturn = (id: string, direction: -1 | 1) => {
    const index = returns.findIndex((item) => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= returns.length) return
    const next = [...returns]
    ;[next[index], next[target]] = [next[target], next[index]]
    save({ ...config, returns: next.map((item, order) => ({ ...item, order })) })
  }
  const deleteReturn = (id: string) =>
    save({ ...config, returns: returns.filter((item) => item.id !== id).map((item, order) => ({ ...item, order })) })
  const addReturn = () =>
    save({
      ...config,
      returns: [
        ...returns,
        {
          id: uid(),
          order: returns.length,
          destination: '',
          system: 'Wedge',
          stereo: false,
          outputStart: nextReturnOutput(returns),
          notes: '',
        },
      ],
    })

  const exportPdf = async () => {
    const { exportInputListPdf } = await import('../lib/inputListPdf')
    exportInputListPdf(show, pdfOrientation)
  }

  const applySync = () => {
    save(syncPreview.next)
    setSyncOpen(false)
    showToast(
      `Input list actualizado: ${syncPreview.additions.length} agregados, ${syncPreview.removals.length} eliminados`,
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
        <header className="flex flex-col gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText size={19} />
              <h2 className="truncate font-semibold">Input list · {show.name}</h2>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs muted">
              <span>{rows.length} entradas</span>
              <span>·</span>
              <span>{returns.length} retornos</span>
              {config.lastSyncedAt && <><span>·</span><span>Actualizado desde equipo {new Date(config.lastSyncedAt).toLocaleString()}</span></>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSyncOpen(true)}>
              <RefreshCw size={14} />Actualizar desde equipo
            </Button>
            <Select value={pdfOrientation} onChange={(event) => setPdfOrientation(event.target.value as PdfOrientation)} className="h-8 w-auto py-1 text-xs">
              <option value="landscape">PDF horizontal</option>
              <option value="portrait">PDF vertical</option>
            </Select>
            <Button size="sm" onClick={() => void exportPdf()}>
              <Download size={14} />Exportar PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar input list"><X size={18} /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-[1500px] space-y-6">
            <section className="panel overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Entradas</h3>
                  <p className="text-xs muted">El número de canal es editable y se conserva aunque cambies el orden.</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label>Canal inicial</Label>
                    <Input
                      type="number"
                      min="1"
                      value={config.channelStart}
                      onChange={(event) => save({ ...config, channelStart: Math.max(1, Number(event.target.value) || 1) })}
                      className="h-8 w-24 py-1 text-sm"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => save({ ...config, rows: renumberInputRows(rows, config.channelStart) })}
                    disabled={!rows.length}
                  >
                    <Hash size={14} />Renumerar
                  </Button>
                  <Button size="sm" onClick={addRow}><Plus size={14} />Entrada manual</Button>
                </div>
              </div>
              {!rows.length ? (
                <div className="p-8 text-center text-sm muted">No hay entradas. Agrega una manualmente o actualiza desde Equipo.</div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1050px]">
                    <div className="grid grid-cols-[72px_minmax(170px,1.2fr)_minmax(170px,1fr)_70px_minmax(130px,.7fr)_minmax(210px,1.3fr)_116px] gap-2 border-b border-[var(--line)] bg-[var(--panel-2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide muted">
                      <div>CH</div><div>Uso</div><div>Equipo</div><div>48V</div><div>Patch</div><div>Notas</div><div />
                    </div>
                    <div className="divide-y divide-[var(--line)]">
                      {rows.map((row, index) => (
                        <div key={row.id} className="grid grid-cols-[72px_minmax(170px,1.2fr)_minmax(170px,1fr)_70px_minmax(130px,.7fr)_minmax(210px,1.3fr)_116px] items-center gap-2 px-4 py-3">
                          <div><Input value={row.channel} onChange={(event) => updateRow(row.id, { channel: event.target.value })} inputMode="numeric" className="text-center font-semibold tabular-nums" aria-label={`Canal de ${row.use || row.equipment || `entrada ${index + 1}`}`} /></div>
                          <div><Input value={row.use} onChange={(event) => updateRow(row.id, { use: event.target.value })} placeholder="Snare Up, Voz…" /></div>
                          <div><Input value={row.equipment} onChange={(event) => updateRow(row.id, { equipment: event.target.value })} placeholder="SM58, DI…" /></div>
                          <label className="flex cursor-pointer items-center justify-center"><input type="checkbox" checked={row.phantom} onChange={(event) => updateRow(row.id, { phantom: event.target.checked })} className="h-4 w-4" /></label>
                          <div><Input value={row.patch || ''} onChange={(event) => updateRow(row.id, { patch: event.target.value || undefined })} placeholder="A1 / Local 1" /></div>
                          <div><Input value={row.notes || ''} onChange={(event) => updateRow(row.id, { notes: event.target.value || undefined })} placeholder="Notas técnicas" /></div>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveRow(row.id, -1)} aria-label="Subir entrada"><ArrowUp size={14} /></Button>
                            <Button variant="ghost" size="icon" disabled={index === rows.length - 1} onClick={() => moveRow(row.id, 1)} aria-label="Bajar entrada"><ArrowDown size={14} /></Button>
                            <Button variant="danger" size="icon" onClick={() => deleteRow(row.id)} aria-label="Eliminar entrada"><Trash2 size={14} /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Retornos de monitoreo</h3>
                  <p className="text-xs muted">Un retorno estéreo ocupa dos salidas consecutivas.</p>
                </div>
                <Button size="sm" onClick={addReturn}><Plus size={14} />Retorno</Button>
              </div>
              {!returns.length ? (
                <div className="p-8 text-center text-sm muted">Todavía no hay retornos de monitoreo.</div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-[55px_minmax(180px,1fr)_minmax(150px,.8fr)_120px_120px_minmax(220px,1.2fr)_116px] gap-2 border-b border-[var(--line)] bg-[var(--panel-2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide muted">
                      <div>Mix</div><div>Destino</div><div>Sistema</div><div>Tipo</div><div>Salida</div><div>Contenido / notas</div><div />
                    </div>
                    <div className="divide-y divide-[var(--line)]">
                      {returns.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-[55px_minmax(180px,1fr)_minmax(150px,.8fr)_120px_120px_minmax(220px,1.2fr)_116px] items-center gap-2 px-4 py-3">
                          <div className="text-center font-semibold tabular-nums">{index + 1}</div>
                          <Input value={item.destination} onChange={(event) => updateReturn(item.id, { destination: event.target.value })} placeholder="Voz principal" />
                          <Input value={item.system} onChange={(event) => updateReturn(item.id, { system: event.target.value })} placeholder="IEM / Wedge" />
                          <Select value={item.stereo ? 'stereo' : 'mono'} onChange={(event) => updateReturn(item.id, { stereo: event.target.value === 'stereo' })}><option value="mono">Mono</option><option value="stereo">Estéreo</option></Select>
                          <div className="space-y-1"><Input type="number" min="1" value={item.outputStart} onChange={(event) => updateReturn(item.id, { outputStart: Math.max(1, Number(event.target.value) || 1) })} /><div className="text-center text-[11px] muted">{outputLabel(item)}</div></div>
                          <Input value={item.notes || ''} onChange={(event) => updateReturn(item.id, { notes: event.target.value || undefined })} placeholder="Voz, tracks, click…" />
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveReturn(item.id, -1)} aria-label="Subir retorno"><ArrowUp size={14} /></Button>
                            <Button variant="ghost" size="icon" disabled={index === returns.length - 1} onClick={() => moveReturn(item.id, 1)} aria-label="Bajar retorno"><ArrowDown size={14} /></Button>
                            <Button variant="danger" size="icon" onClick={() => deleteReturn(item.id)} aria-label="Eliminar retorno"><Trash2 size={14} /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="panel p-5">
              <Label>Notas generales del input list</Label>
              <Textarea value={config.generalNotes || ''} onChange={(event) => save({ ...config, generalNotes: event.target.value || undefined })} placeholder="Indicaciones generales de patch, consola, stagebox o monitoreo…" />
            </section>
          </div>
        </div>
      </div>

      <Modal
        open={syncOpen}
        title="Actualizar input list desde Equipo"
        onClose={() => setSyncOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setSyncOpen(false)}>Cancelar</Button><Button onClick={applySync}>Aplicar actualización</Button></>}
      >
        <div className="space-y-4">
          <p className="text-sm muted">Las entradas manuales y los campos que hayas editado se conservarán. Solo se agregan o eliminan unidades según la lista de Equipo.</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3"><div className="text-xl font-semibold">{syncPreview.additions.length}</div><div className="text-xs muted">Por agregar</div></div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3"><div className="text-xl font-semibold">{syncPreview.removals.length}</div><div className="text-xs muted">Por eliminar</div></div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3"><div className="text-xl font-semibold">{syncPreview.updates.length}</div><div className="text-xs muted">Referencias actualizadas</div></div>
          </div>
          {!syncPreview.additions.length && !syncPreview.removals.length && !syncPreview.updates.length ? <Badge tone="success">El input list ya coincide con Equipo</Badge> : null}
          {syncPreview.additions.length > 0 && <div><Label>Se agregarán</Label><div className="max-h-36 space-y-1 overflow-auto rounded-xl border border-[var(--line)] p-3 text-sm">{syncPreview.additions.map((row) => <div key={row.id}>{row.use || 'Sin uso'} · {row.equipment}</div>)}</div></div>}
          {syncPreview.removals.length > 0 && <div><Label>Se eliminarán</Label><div className="max-h-36 space-y-1 overflow-auto rounded-xl border border-[var(--line)] p-3 text-sm">{syncPreview.removals.map((row) => <div key={row.id}>{row.use || 'Sin uso'} · {row.equipment}</div>)}</div></div>}
        </div>
      </Modal>
    </>
  )
}
