import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Info,
  ListOrdered,
  Lock,
  CloudOff,
  Share2,
  Package,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react'
import { useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store'
import type { ScheduleItem, Show, ShowEquipmentItem, ShowPerson } from '../types'
import { scheduleDuration } from '../lib/utils'
import { createInputList, normalizeAssignments } from '../lib/inputList'
import { useShowLock } from '../lib/useShowLock'
import { Badge, Button, EmptyState, Field, Input, Label, Modal, ProgressBar, SearchInput, Select, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { InputListModal } from '../components/InputListModal'

type Tab = 'equipment' | 'people' | 'info'

export default function ShowPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const lock = useShowLock(id)
  const { showToast } = useToast()
  const show = useAppStore((state) => state.shows.find((item) => item.id === id))
  const updateShow = useAppStore((state) => state.updateShow)
  const preferences = useAppStore((state) => state.preferences)
  const updatePreferences = useAppStore((state) => state.updatePreferences)
  const archiveShow = useAppStore((state) => state.archiveShow)
  const createPresetFromShow = useAppStore((state) => state.createPresetFromShow)
  const applyPreset = useAppStore((state) => state.applyPreset)
  const allPresets = useAppStore((state) => state.presets)
  const presets = useMemo(() => allPresets.filter((item) => !item.archived), [allPresets])
  const [tab, setTab] = useState<Tab>('equipment')
  const [presetOpen, setPresetOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [inputListOpen, setInputListOpen] = useState(false)
  const [inputWarningOpen, setInputWarningOpen] = useState(false)

  if (!show) return <EmptyState title="Show no encontrado" description="Es posible que haya sido eliminado o que el enlace ya no sea válido." action={<Button onClick={() => navigate('/shows')}>Volver a Shows</Button>} />

  if (lock.status === 'checking') return <div><Link to="/shows" className="mb-4 inline-flex items-center gap-2 text-sm muted hover:text-[var(--text)]"><ArrowLeft size={16} />Todos los shows</Link><div className="panel flex min-h-64 items-center justify-center p-8 text-center"><div><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--text)]" /><h2 className="font-semibold">Comprobando disponibilidad</h2><p className="mt-2 text-sm muted">Verificando que ningún otro dispositivo esté editando este show.</p></div></div></div>

  if (lock.status === 'blocked' || lock.status === 'idle') return <div><Link to="/shows" className="mb-4 inline-flex items-center gap-2 text-sm muted hover:text-[var(--text)]"><ArrowLeft size={16} />Todos los shows</Link><div className="panel mx-auto max-w-2xl p-7 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel-2)]"><Lock size={22} /></div><h1 className="text-xl font-semibold">{lock.status === 'idle' ? 'Edición pausada por inactividad' : 'Show en edición'}</h1><p className="mx-auto mt-2 max-w-lg text-sm muted">{lock.status === 'idle' ? 'El bloqueo se liberó después de 10 minutos sin actividad. Comprueba nuevamente para continuar editando.' : `${lock.deviceLabel || 'Otro dispositivo'} está editando este show. El acceso se habilitará cuando cierre el show o el bloqueo expire.`}</p><div className="mt-5 flex justify-center gap-2"><Button variant="secondary" onClick={() => navigate('/shows')}>Volver</Button><Button onClick={() => void lock.retry()}>Comprobar nuevamente</Button></div><p className="mt-4 text-xs muted">No existe una opción de forzar desbloqueo.</p></div></div>

  const checked = show.equipment.filter((item) => item.checked).length
  const progress = show.equipment.length ? Math.round((checked / show.equipment.length) * 100) : 0
  const pendingEquipment = show.equipment.length - checked
  const openInputList = () => {
    if (!show.inputList) updateShow(show.id, { inputList: createInputList(show) })
    setInputWarningOpen(false)
    setInputListOpen(true)
  }
  const requestInputList = () => {
    if (pendingEquipment > 0 && preferences.showInputListWarnings) setInputWarningOpen(true)
    else openInputList()
  }
  const sharePublicLink = async () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}#/public/${show.publicSlug}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      showToast('Enlace público copiado')
    } catch {
      window.prompt('Copia el enlace público del show:', publicUrl)
    }
  }

  return (
    <>
      {lock.status !== 'owned' && <div className={`mb-5 flex gap-3 border-2 border-[var(--strong-line)] p-4 shadow-[4px_4px_0_var(--shadow-ink)] ${lock.status === 'offline' ? 'bg-[var(--accent)] text-white' : 'warning-panel'}`}><CloudOff className="mt-0.5 flex-none" size={19} /><div><p className="font-mono text-xs font-bold uppercase tracking-[.08em]">{lock.status === 'offline' ? 'Edición sin conexión' : lock.status === 'waiting' ? 'Preparando el bloqueo en línea' : 'No fue posible verificar el bloqueo'}</p><p className="mt-1 text-xs opacity-80">{lock.status === 'offline' ? 'Puedes trabajar normalmente. Al volver la conexión, se comprobarán cambios y posibles conflictos.' : lock.status === 'waiting' ? 'El show todavía se está publicando en la nube. Puedes continuar editando en este dispositivo.' : 'Los cambios se guardarán localmente e intentarán sincronizarse de nuevo.'}</p></div></div>}
      <div className="mb-5">
        <Link to="/shows" className="mb-4 inline-flex items-center gap-2 text-sm muted hover:text-[var(--text)]"><ArrowLeft size={16} />Todos los shows</Link>
        <div className="flex flex-col gap-4">
          <div className="min-w-0 flex-1">
            <Input value={show.name} onChange={(event) => updateShow(show.id, { name: event.target.value })} className="h-auto truncate border-transparent bg-transparent p-0 text-3xl font-black uppercase leading-[.9] tracking-[-.05em] focus:border-transparent focus:shadow-none sm:text-5xl lg:text-6xl" aria-label="Nombre del show" title={show.name} />
            <div className="mt-2 flex flex-wrap gap-2">{show.date && <Badge>{show.date}</Badge>}{show.time && <Badge>{show.time}</Badge>}{show.showType && <Badge>{show.showType}</Badge>}{show.archived && <Badge>Archivado</Badge>}</div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-dashed border-[var(--line)] pt-4 sm:justify-end">
            <Button variant="secondary" onClick={() => void sharePublicLink()}><Share2 size={16} />Compartir</Button>
            <Button onClick={requestInputList}><ListOrdered size={16} />Input list</Button>
            <Button variant="secondary" onClick={() => { setPresetName(`${show.name} — preset`); setPresetOpen(true) }}><Save size={16} />Guardar preset</Button>
            <Button variant="secondary" onClick={() => setApplyOpen(true)} disabled={!presets.length}><Copy size={16} />Aplicar preset</Button>
            <Button variant="secondary" onClick={() => archiveShow(show.id, !show.archived)}><Archive size={16} />{show.archived ? 'Restaurar' : 'Archivar'}</Button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="flex overflow-x-auto border-2 border-[var(--strong-line)] bg-[var(--panel)] p-1">
          {([
            ['equipment', 'Equipo', Package],
            ['people', 'Personas', Users],
            ['info', 'Información', Info],
          ] as const).map(([value, label, Icon]) => <button key={value} onClick={() => setTab(value)} className={`flex min-h-11 min-w-max flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[.08em] transition ${tab === value ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted hover:bg-[var(--panel-2)] hover:text-[var(--text)]'}`}><Icon size={16} />{label}</button>)}
        </div>
        <div className="panel flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[.08em]"><span className="muted">Progreso de equipo</span><span>{checked}/{show.equipment.length}</span></div><ProgressBar value={progress} /></div><strong className="font-mono text-sm">{progress}%</strong></div>
      </div>

      {tab === 'equipment' && <EquipmentTab show={show} />}
      {tab === 'people' && <PeopleTab show={show} />}
      {tab === 'info' && <InfoTab show={show} />}

      <Modal open={presetOpen} title="Crear preset desde este show" onClose={() => setPresetOpen(false)} footer={<><Button variant="secondary" onClick={() => setPresetOpen(false)}>Cancelar</Button><Button disabled={!presetName.trim()} onClick={() => { createPresetFromShow(show.id, presetName); setPresetOpen(false) }}>Crear preset</Button></>}><Field label="Nombre del preset"><Input value={presetName} onChange={(event) => setPresetName(event.target.value)} autoFocus /></Field></Modal>
      <ApplyPresetModal open={applyOpen} onClose={() => setApplyOpen(false)} presets={presets} onApply={(presetId, mode) => { applyPreset(show.id, presetId, mode); setApplyOpen(false) }} />
      <Modal open={inputWarningOpen} title="Equipo todavía pendiente" onClose={() => setInputWarningOpen(false)} footer={<><Button variant="secondary" onClick={() => setInputWarningOpen(false)}>Cancelar</Button><Button variant="secondary" onClick={() => { updatePreferences({ showInputListWarnings: false }); openInputList() }}>No volver a mostrar</Button><Button onClick={openInputList}>Continuar</Button></>}>
        <div className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4"><AlertTriangle className="mt-0.5 flex-none" size={20} /><div><p className="text-sm font-medium">Hay {pendingEquipment} elementos de equipo sin marcar como listos.</p><p className="mt-1 text-xs muted">Puedes abrir y editar el input list de todas formas. La advertencia puede reactivarse desde Preferencias.</p></div></div>
      </Modal>
      <ErrorBoundary onPrimaryAction={() => setInputListOpen(false)} primaryActionLabel="Cerrar input list" title="El input list no pudo cargarse" description="El resto del show sigue disponible. Tus datos siguen guardados en este dispositivo.">
        <InputListModal open={inputListOpen} show={show} onClose={() => setInputListOpen(false)} />
      </ErrorBoundary>
    </>
  )
}

function EquipmentTab({ show }: { show: Show }) {
  const { showToast } = useToast()
  const library = useAppStore((state) => state.library)
  const addShowCategory = useAppStore((state) => state.addShowCategory)
  const updateShowCategory = useAppStore((state) => state.updateShowCategory)
  const moveShowCategory = useAppStore((state) => state.moveShowCategory)
  const deleteShowCategory = useAppStore((state) => state.deleteShowCategory)
  const addEquipment = useAppStore((state) => state.addEquipment)
  const updateEquipment = useAppStore((state) => state.updateEquipment)
  const duplicateEquipment = useAppStore((state) => state.duplicateEquipment)
  const deleteEquipment = useAppStore((state) => state.deleteEquipment)
  const restoreEquipment = useAppStore((state) => state.restoreEquipment)
  const moveEquipment = useAppStore((state) => state.moveEquipment)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')

  const categories = [...show.equipmentCategories].sort((a, b) => a.order - b.order)
  const handleDrop = (event: DragEvent, categoryId: string) => {
    event.preventDefault()
    const itemId = event.dataTransfer.getData('text/equipment-id')
    if (itemId) moveEquipment(show.id, itemId, categoryId)
  }

  return <>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Buscar equipo…" /></div><Button variant="secondary" onClick={() => setCategoryOpen(true)}><Plus size={16} />Categoría</Button><Button onClick={() => setAddOpen(true)}><Plus size={16} />Agregar equipo</Button></div>
    <div className="space-y-4">
      {categories.map((category, index) => {
        const items = show.equipment.filter((item) => item.categoryId === category.id && item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => a.order - b.order)
        const allInCategory = show.equipment.filter((item) => item.categoryId === category.id)
        const completed = allInCategory.filter((item) => item.checked).length
        const percent = allInCategory.length ? Math.round((completed / allInCategory.length) * 100) : 0
        return <section key={category.id} className="panel overflow-hidden border-l-4 border-l-[var(--accent)]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, category.id)}>
          <div className="flex flex-col gap-3 border-b-2 border-[var(--strong-line)] bg-[var(--panel-2)] px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><Input value={category.name} onChange={(event) => updateShowCategory(show.id, category.id, { name: event.target.value })} className="border-transparent bg-transparent p-0 font-semibold focus:border-transparent focus:shadow-none" aria-label={`Nombre de categoría: ${category.name}`} /><div className="mt-2 max-w-xs"><ProgressBar value={percent} /></div></div>
            <div className="flex items-center gap-1"><span className="mr-2 font-mono text-[10px] font-bold muted">{completed}/{allInCategory.length}</span><Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveShowCategory(show.id, category.id, -1)} aria-label="Subir categoría"><ChevronUp size={16} /></Button><Button variant="ghost" size="icon" disabled={index === categories.length - 1} onClick={() => moveShowCategory(show.id, category.id, 1)} aria-label="Bajar categoría"><ChevronDown size={16} /></Button><Button variant="ghost" size="icon" disabled={categories.length <= 1} onClick={() => deleteShowCategory(show.id, category.id)} aria-label="Eliminar categoría"><Trash2 size={16} /></Button></div>
          </div>
          {!items.length ? <div className="p-5 text-sm muted">{search ? 'No hay coincidencias en esta categoría.' : 'Arrastra equipo aquí o agrega un elemento.'}</div> : <div className="divide-y divide-[var(--line)]">{items.map((item, itemIndex) => <EquipmentRow key={item.id} show={show} item={item} categories={categories} origins={library.origins.filter((origin) => !origin.archived).map((origin) => origin.name)} canMoveUp={itemIndex > 0} canMoveDown={itemIndex < items.length - 1} onUpdate={(patch) => updateEquipment(show.id, item.id, patch)} onDropItem={(draggedId) => moveEquipment(show.id, draggedId, category.id, item.order)} onMove={(direction) => { const neighbor = items[itemIndex + direction]; if (!neighbor) return; moveEquipment(show.id, item.id, item.categoryId, direction === -1 ? neighbor.order - 0.5 : neighbor.order + 0.5); showToast('Equipo movido') }} onMoveToCategory={(categoryId) => { moveEquipment(show.id, item.id, categoryId); showToast(`Movido a "${categories.find((entry) => entry.id === categoryId)?.name}"`) }} onDuplicate={() => duplicateEquipment(show.id, item.id)} onDelete={() => { const removed = deleteEquipment(show.id, item.id); if (removed) showToast('Equipo eliminado', { onAction: () => restoreEquipment(show.id, removed) }) }} />)}</div>}
        </section>
      })}
    </div>
    {!categories.length && <EmptyState title="No hay categorías" description="Crea una categoría para comenzar a organizar el equipo." action={<Button onClick={() => setCategoryOpen(true)}>Crear categoría</Button>} />}
    <Modal open={categoryOpen} title="Nueva categoría" onClose={() => setCategoryOpen(false)} footer={<><Button variant="secondary" onClick={() => setCategoryOpen(false)}>Cancelar</Button><Button disabled={!categoryName.trim()} onClick={() => { addShowCategory(show.id, categoryName); setCategoryName(''); setCategoryOpen(false) }}>Crear</Button></>}><Field label="Nombre"><Input autoFocus value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ej. Hospitality" /></Field></Modal>
    <AddEquipmentModal open={addOpen} onClose={() => setAddOpen(false)} show={show} onAdd={(input, libraryId) => { addEquipment(show.id, input, libraryId); setAddOpen(false) }} />
  </>
}

function EquipmentRow({ item, show, categories, origins, canMoveUp, canMoveDown, onUpdate, onDropItem, onMove, onMoveToCategory, onDuplicate, onDelete }: { item: ShowEquipmentItem; show: Show; categories: { id: string; name: string }[]; origins: string[]; canMoveUp: boolean; canMoveDown: boolean; onUpdate: (patch: Partial<ShowEquipmentItem>) => void; onDropItem: (draggedId: string) => void; onMove: (direction: -1 | 1) => void; onMoveToCategory: (categoryId: string) => void; onDuplicate: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const assignments = normalizeAssignments(item.assignments, item.quantity)
  const assignedUses = assignments.filter((assignment) => assignment.use.trim())
  const useSummary = assignedUses.map((assignment) => assignment.use.trim()).join(', ')
  const updateAssignment = (assignmentId: string, use: string) =>
    onUpdate({ assignments: assignments.map((assignment) => (assignment.id === assignmentId ? { ...assignment, use } : assignment)) })

  return <div draggable onDragStart={(event) => { event.dataTransfer.setData('text/equipment-id', item.id); event.dataTransfer.effectAllowed = 'move' }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const draggedId = event.dataTransfer.getData('text/equipment-id'); if (draggedId && draggedId !== item.id) onDropItem(draggedId) }}>
    <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
      <GripVertical size={16} className="cursor-grab muted" aria-hidden="true" />
      <div className="flex flex-none flex-col">
        <Button variant="ghost" size="icon" className="!h-11 !w-11 sm:!h-8 sm:!w-8" disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label={`Subir ${item.name}`}><ChevronUp size={14} /></Button>
        <Button variant="ghost" size="icon" className="!h-11 !w-11 sm:!h-8 sm:!w-8" disabled={!canMoveDown} onClick={() => onMove(1)} aria-label={`Bajar ${item.name}`}><ChevronDown size={14} /></Button>
      </div>
      <button onClick={() => onUpdate({ checked: !item.checked })} className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border transition ${item.checked ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]' : 'border-[var(--strong-line)]'}`} aria-label={item.checked ? 'Marcar pendiente' : 'Marcar listo'}>{item.checked && <Check size={15} />}</button>
      <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(!expanded)}>
        <div className={`truncate text-sm font-medium ${item.checked ? 'line-through opacity-55' : ''}`}>{item.quantity} {item.unit || '×'} {item.name}</div>
        <div className="mt-0.5 truncate text-xs muted">
          {item.originName || 'Sin origen'}
          {item.includeInInputList !== false ? ` · Input list ${assignedUses.length}/${item.quantity}` : ' · Fuera del input list'}
          {useSummary ? ` · ${useSummary}` : item.notes ? ` · ${item.notes}` : ''}
        </div>
      </button>
      <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)} aria-label="Editar">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</Button>
    </div>
    {expanded && categories.length > 1 && <div className="border-t border-[var(--line)] bg-[var(--panel-2)] px-4 py-3">
      <Field label="Mover a categoría"><Select value={item.categoryId} onChange={(event) => onMoveToCategory(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
    </div>}
    {expanded && <div className="grid gap-4 border-t border-[var(--line)] bg-[var(--panel-2)] p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Nombre"><Input value={item.name} onChange={(event) => onUpdate({ name: event.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Cantidad"><Input type="number" min="0" step="1" value={item.quantity} onChange={(event) => onUpdate({ quantity: Number(event.target.value) })} /></Field><Field label="Unidad"><Input value={item.unit || ''} onChange={(event) => onUpdate({ unit: event.target.value || undefined })} placeholder="pzas" /></Field></div>
      <Field label="Origen"><Input list={`origins-${item.id}`} value={item.originName || ''} onChange={(event) => onUpdate({ originName: event.target.value || undefined })} placeholder="Propio, renta…" /></Field><datalist id={`origins-${item.id}`}>{origins.map((origin) => <option key={origin}>{origin}</option>)}</datalist>
      <Field label="Categoría"><Select value={item.categoryId} onChange={(event) => onUpdate({ categoryId: event.target.value })}>{[...show.equipmentCategories].sort((a, b) => a.order - b.order).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>

      <div className="sm:col-span-2 lg:col-span-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <input type="checkbox" checked={item.includeInInputList !== false} onChange={(event) => onUpdate({ includeInInputList: event.target.checked })} className="mt-0.5 h-4 w-4" />
          <div><div className="text-sm font-medium">Incluir en input list</div><div className="mt-1 text-xs muted">Activado de forma predeterminada. Desactívalo para equipo que no necesita una entrada de consola.</div></div>
        </label>
      </div>

      {item.includeInInputList !== false && <div className="sm:col-span-2 lg:col-span-4">
        <div className="mb-2 flex items-end justify-between gap-3"><div><Label>Uso por unidad</Label><p className="text-xs muted">Las unidades permanecen agrupadas en la lista, pero cada una puede generar una entrada distinta.</p></div><Badge>{assignedUses.length}/{item.quantity} asignados</Badge></div>
        {!assignments.length ? <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm muted">Aumenta la cantidad para crear asignaciones.</div> : <div className="grid gap-2 sm:grid-cols-2">{assignments.map((assignment, index) => <div key={assignment.id} className="grid grid-cols-[70px_1fr] items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2"><div className="text-center text-xs font-semibold muted">Unidad {index + 1}</div><Input value={assignment.use} onChange={(event) => updateAssignment(assignment.id, event.target.value)} placeholder="Snare Up, Overhead L, Voz…" /></div>)}</div>}
      </div>}

      <div className="sm:col-span-2 lg:col-span-4"><Field label="Notas"><Textarea value={item.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value || undefined })} /></Field></div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><Button variant="secondary" size="sm" onClick={onDuplicate}><Copy size={14} />Duplicar</Button><Button variant="danger" size="sm" onClick={onDelete}><Trash2 size={14} />Eliminar</Button></div>
    </div>}
  </div>
}

function AddEquipmentModal({ open, onClose, show, onAdd }: { open: boolean; onClose: () => void; show: Show; onAdd: (input: Partial<ShowEquipmentItem> & { name: string }, libraryId?: string) => void }) {
  const library = useAppStore((state) => state.library)
  const [mode, setMode] = useState<'library' | 'free'>('library')
  const [libraryId, setLibraryId] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(show.equipmentCategories[0]?.id || '')
  const [quantity, setQuantity] = useState(1)
  const [search, setSearch] = useState('')
  const catalog = library.equipment.filter((item) => !item.archived && item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'library' && libraryId) {
      const item = library.equipment.find((entry) => entry.id === libraryId)
      if (item) onAdd({ name: item.name, quantity, categoryId: categoryId || undefined }, libraryId)
    } else if (name.trim()) onAdd({ name: name.trim(), quantity, categoryId })
  }
  return <Modal open={open} title="Agregar equipo" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="add-equipment" disabled={mode === 'library' ? !libraryId : !name.trim()}>Agregar</Button></>}>
    <form id="add-equipment" onSubmit={submit} className="space-y-4">
      <div className="flex rounded-xl border border-[var(--line)] p-1"><button type="button" onClick={() => setMode('library')} className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === 'library' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`}>Desde Biblioteca</button><button type="button" onClick={() => setMode('free')} className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === 'free' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`}>Creación libre</button></div>
      {mode === 'library' ? <><SearchInput value={search} onChange={setSearch} placeholder="Buscar en Biblioteca…" /><div className="max-h-56 space-y-2 overflow-auto">{catalog.map((item) => <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${libraryId === item.id ? 'border-[var(--text)]' : 'border-[var(--line)]'}`}><input type="radio" name="equipment-library" value={item.id} checked={libraryId === item.id} onChange={() => setLibraryId(item.id)} /><div><div className="text-sm font-medium">{item.name}</div><div className="text-xs muted">{item.unit || 'Sin unidad'} · {library.categories.find((category) => category.id === item.categoryId)?.name || 'Sin categoría'}</div></div></label>)}{!catalog.length && <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center text-sm muted">No hay equipo en la Biblioteca. Usa creación libre.</div>}</div></> : <Field label="Nombre"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. 2 micrófonos inalámbricos" /></Field>}
      <div className="grid grid-cols-2 gap-4"><Field label="Cantidad"><Input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></Field><Field label="Categoría"><Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{[...show.equipmentCategories].sort((a, b) => a.order - b.order).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</Select></Field></div>
    </form>
  </Modal>
}

function PeopleTab({ show }: { show: Show }) {
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const updatePerson = useAppStore((state) => state.updatePerson)
  const deletePerson = useAppStore((state) => state.deletePerson)
  const restorePerson = useAppStore((state) => state.restorePerson)
  const addPerson = useAppStore((state) => state.addPerson)
  const people = show.people.filter((person) => `${person.name} ${person.company || ''} ${person.roleNames.join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => a.order - b.order)
  return <>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Buscar persona, empresa o función…" /></div><Button onClick={() => setAddOpen(true)}><Plus size={16} />Agregar persona</Button></div>
    {!people.length ? <EmptyState title={search ? 'Sin coincidencias' : 'No hay personas'} description={search ? 'Prueba con otro término.' : 'Agrega contactos desde la Biblioteca o crea personas solo para este show.'} action={!search ? <Button onClick={() => setAddOpen(true)}>Agregar persona</Button> : undefined} /> : <div className="panel divide-y divide-[var(--line)]">{people.map((person, index) => <PersonRow key={person.id} person={person} canMoveUp={index > 0} canMoveDown={index < people.length - 1} onMove={(direction) => { const target = people[index + direction]; if (!target) return; updatePerson(show.id, person.id, { order: target.order }); updatePerson(show.id, target.id, { order: person.order }) }} onUpdate={(patch) => updatePerson(show.id, person.id, patch)} onDelete={() => { const removed = deletePerson(show.id, person.id); if (removed) showToast('Persona eliminada', { onAction: () => restorePerson(show.id, removed) }) }} />)}</div>}
    <AddPersonModal open={addOpen} onClose={() => setAddOpen(false)} show={show} onAdd={(input, libraryId) => { const id = addPerson(show.id, input, libraryId); if (!id) showToast('Esa persona ya está en el show'); else setAddOpen(false) }} />
  </>
}

function PersonRow({ person, canMoveUp, canMoveDown, onMove, onUpdate, onDelete }: { person: ShowPerson; canMoveUp: boolean; canMoveDown: boolean; onMove: (direction: -1 | 1) => void; onUpdate: (patch: Partial<ShowPerson>) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return <div><div className="flex items-center gap-2 px-4 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--panel-2)] text-sm font-semibold">{person.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div><button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(!expanded)}><div className="truncate font-medium">{person.name}</div><div className="truncate text-xs muted">{[person.company, ...person.roleNames].filter(Boolean).join(' · ') || 'Sin función'}</div></button><Button variant="ghost" size="icon" disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label="Subir persona"><ChevronUp size={15} /></Button><Button variant="ghost" size="icon" disabled={!canMoveDown} onClick={() => onMove(1)} aria-label="Bajar persona"><ChevronDown size={15} /></Button><Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)} aria-label={`${expanded ? 'Contraer' : 'Expandir'} ${person.name}`}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</Button></div>
    {expanded && <div className="grid gap-4 border-t border-[var(--line)] bg-[var(--panel-2)] p-4 sm:grid-cols-2">
      <Field label="Nombre"><Input value={person.name} onChange={(event) => onUpdate({ name: event.target.value })} /></Field><Field label="Empresa"><Input value={person.company || ''} onChange={(event) => onUpdate({ company: event.target.value || undefined })} /></Field>
      <Field label="Tipos"><Input value={person.typeNames.join(', ')} onChange={(event) => onUpdate({ typeNames: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="Equipo, proveedor…" /></Field><Field label="Funciones"><Input value={person.roleNames.join(', ')} onChange={(event) => onUpdate({ roleNames: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="Manager, audio…" /></Field>
      <Field label="Teléfonos"><Textarea value={person.phones.join('\n')} onChange={(event) => onUpdate({ phones: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} placeholder="Uno por línea" /></Field><Field label="Correos"><Textarea value={person.emails.join('\n')} onChange={(event) => onUpdate({ emails: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} placeholder="Uno por línea" /></Field>
      <div className="sm:col-span-2"><Field label="Notas"><Textarea value={person.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value || undefined })} /></Field></div><div className="sm:col-span-2"><Button variant="danger" size="sm" onClick={onDelete}><Trash2 size={14} />Eliminar</Button></div>
    </div>}</div>
}

function AddPersonModal({ open, onClose, show, onAdd }: { open: boolean; onClose: () => void; show: Show; onAdd: (input: Partial<ShowPerson> & { name: string }, libraryId?: string) => void }) {
  const library = useAppStore((state) => state.library)
  const [mode, setMode] = useState<'library' | 'free'>('library')
  const [libraryId, setLibraryId] = useState('')
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const catalog = library.people.filter((person) => !person.archived && !show.people.some((existing) => existing.sourceLibraryId === person.id || existing.name.toLocaleLowerCase() === person.name.toLocaleLowerCase()) && `${person.name} ${person.company || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <Modal open={open} title="Agregar persona" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={mode === 'library' ? !libraryId : !name.trim()} onClick={() => { if (mode === 'library') { const person = library.people.find((item) => item.id === libraryId); if (person) onAdd({ name: person.name }, person.id) } else onAdd({ name: name.trim() }) }}>Agregar</Button></>}>
    <div className="space-y-4"><div className="flex rounded-xl border border-[var(--line)] p-1"><button type="button" onClick={() => setMode('library')} className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === 'library' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`}>Desde Biblioteca</button><button type="button" onClick={() => setMode('free')} className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === 'free' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`}>Creación libre</button></div>
      {mode === 'library' ? <><SearchInput value={search} onChange={setSearch} placeholder="Buscar en Biblioteca…" /><div className="max-h-64 space-y-2 overflow-auto">{catalog.map((person) => <label key={person.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${libraryId === person.id ? 'border-[var(--text)]' : 'border-[var(--line)]'}`}><input type="radio" checked={libraryId === person.id} onChange={() => setLibraryId(person.id)} /><div><div className="text-sm font-medium">{person.name}</div><div className="text-xs muted">{person.company || 'Sin empresa'}</div></div></label>)}{!catalog.length && <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center text-sm muted">No hay personas disponibles en la Biblioteca.</div>}</div></> : <Field label="Nombre"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre completo" /></Field>}
    </div>
  </Modal>
}

function InfoTab({ show }: { show: Show }) {
  const updateShow = useAppStore((state) => state.updateShow)
  const addSchedule = useAppStore((state) => state.addSchedule)
  const updateSchedule = useAppStore((state) => state.updateSchedule)
  const deleteSchedule = useAppStore((state) => state.deleteSchedule)
  const [addOpen, setAddOpen] = useState(false)
  const schedule = [...show.schedule].sort((a, b) => a.startTime.localeCompare(b.startTime))
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,.9fr)]">
    <section className="panel p-5"><h2 className="mb-5 font-semibold">Información general</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha"><Input type="date" value={show.date || ''} onChange={(event) => updateShow(show.id, { date: event.target.value || undefined })} /></Field><Field label="Hora"><Input type="time" value={show.time || ''} onChange={(event) => updateShow(show.id, { time: event.target.value || undefined })} /></Field><div className="sm:col-span-2"><Field label="Tipo de show"><Input value={show.showType || ''} onChange={(event) => updateShow(show.id, { showType: event.target.value || undefined })} placeholder="Concierto, festival, showcase…" /></Field></div><div className="sm:col-span-2"><Field label="Nota general"><Textarea className="min-h-48" value={show.note || ''} onChange={(event) => updateShow(show.id, { note: event.target.value || undefined })} placeholder="Venue, accesos, necesidades especiales, contexto general…" /></Field></div></div></section>
    <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><div><h2 className="font-semibold">Horarios</h2><p className="text-xs muted">Ordenados automáticamente por hora.</p></div><Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} />Horario</Button></div>{!schedule.length ? <div className="p-8 text-center text-sm muted">Los horarios son opcionales. Agrega soundcheck, puertas, show, desmontaje u otros hitos.</div> : <div className="divide-y divide-[var(--line)]">{schedule.map((item, index) => <ScheduleRow key={item.id} item={item} next={schedule[index + 1]} onUpdate={(patch) => updateSchedule(show.id, item.id, patch)} onDelete={() => deleteSchedule(show.id, item.id)} />)}</div>}</section>
    <AddScheduleModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={(input) => { addSchedule(show.id, input); setAddOpen(false) }} />
  </div>
}

function ScheduleRow({ item, next, onUpdate, onDelete }: { item: ScheduleItem; next?: ScheduleItem; onUpdate: (patch: Partial<ScheduleItem>) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const duration = scheduleDuration(item, next)
  return <div><div className="flex items-center gap-3 px-5 py-4"><div className="w-14 text-sm font-semibold tabular-nums">{item.startTime}</div><button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(!expanded)}><div className="truncate text-sm font-medium">{item.name}</div><div className="text-xs muted">{item.endTime ? `Hasta ${item.endTime}` : next ? `Hasta ${next.startTime}` : 'Sin hora final'}{duration ? ` · ${duration}` : ''}</div></button><Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)} aria-label={`${expanded ? 'Contraer' : 'Expandir'} ${item.name}`}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</Button></div>{expanded && <div className="grid gap-3 border-t border-[var(--line)] bg-[var(--panel-2)] p-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Nombre"><Input value={item.name} onChange={(event) => onUpdate({ name: event.target.value })} /></Field></div><Field label="Inicio"><Input type="time" value={item.startTime} onChange={(event) => onUpdate({ startTime: event.target.value })} /></Field><Field label="Fin opcional"><Input type="time" value={item.endTime || ''} onChange={(event) => onUpdate({ endTime: event.target.value || undefined })} /></Field><div className="sm:col-span-2"><Field label="Notas"><Textarea value={item.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value || undefined })} /></Field></div><div className="sm:col-span-2"><Button variant="danger" size="sm" onClick={onDelete}><Trash2 size={14} />Eliminar</Button></div></div>}</div>
}

function AddScheduleModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (input: Partial<ScheduleItem> & { name: string; startTime: string }) => void }) {
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  return <Modal open={open} title="Nuevo horario" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!name.trim() || !startTime} onClick={() => onAdd({ name: name.trim(), startTime, endTime: endTime || undefined })}>Agregar</Button></>}><div className="space-y-4"><Field label="Nombre"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Soundcheck" /></Field><div className="grid grid-cols-2 gap-4"><Field label="Inicio"><Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field><Field label="Fin opcional"><Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></Field></div></div></Modal>
}

function ApplyPresetModal({ open, onClose, presets, onApply }: { open: boolean; onClose: () => void; presets: { id: string; name: string; equipment: unknown[]; people: unknown[] }[]; onApply: (id: string, mode: 'merge' | 'replace') => void }) {
  const [presetId, setPresetId] = useState('')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const selected = presets.find((item) => item.id === presetId)
  return <Modal open={open} title="Aplicar preset" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!presetId} onClick={() => onApply(presetId, mode)}>Aplicar</Button></>}><div className="space-y-4"><Field label="Preset"><Select value={presetId} onChange={(event) => setPresetId(event.target.value)}><option value="">Selecciona un preset</option>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</Select></Field>{selected &&<div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-sm muted">{selected.equipment.length} elementos de equipo · {selected.people.length} personas</div>}<div><Label>Modo</Label><div className="space-y-2"><label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--line)] p-3"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /><div><div className="text-sm font-medium">Fusionar</div><div className="text-xs muted">Conserva el contenido actual y agrega lo que contiene el preset.</div></div></label><label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--line)] p-3"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /><div><div className="text-sm font-medium">Reemplazar</div><div className="text-xs muted">Sustituye Equipo, Personas y Horarios del show.</div></div></label></div></div></div></Modal>
}
