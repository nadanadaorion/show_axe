import { Archive, Copy, Edit3, Layers, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, Textarea } from '../components/ui'

export default function PresetsPage() {
  const presets = useAppStore((state) => state.presets)
  const allShows = useAppStore((state) => state.shows)
  const shows = useMemo(() => allShows.filter((show) => !show.archived), [allShows])
  const createPresetFromShow = useAppStore((state) => state.createPresetFromShow)
  const duplicatePreset = useAppStore((state) => state.duplicatePreset)
  const updatePreset = useAppStore((state) => state.updatePreset)
  const archivePreset = useAppStore((state) => state.archivePreset)
  const deletePreset = useAppStore((state) => state.deletePreset)
  const applyPreset = useAppStore((state) => state.applyPreset)
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [applyId, setApplyId] = useState<string>()

  const filtered = useMemo(() => presets.filter((preset) => preset.archived === archived && `${preset.name} ${preset.description || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [presets, archived, search])
  const editing = presets.find((item) => item.id === editingId)
  const applying = presets.find((item) => item.id === applyId)

  return <>
    <PageHeader title="Presets" description="Configuraciones reutilizables para iniciar shows con menos pasos." actions={<Button onClick={() => setCreateOpen(true)} disabled={!shows.length}><Plus size={16} />Crear desde show</Button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]"><SearchInput value={search} onChange={setSearch} placeholder="Buscar presets…" /><div className="flex rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1"><button onClick={() => setArchived(false)} className={`rounded-lg px-3 py-2 text-sm ${!archived ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`}>Activos</button><button onClick={() => setArchived(true)} className={`rounded-lg px-3 py-2 text-sm ${archived ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`}>Archivados</button></div></div>

    {!filtered.length ? <EmptyState title={archived ? 'No hay presets archivados' : 'No hay presets'} description={shows.length ? 'Crea uno a partir de un show ya configurado.' : 'Primero crea un show; después podrás guardarlo como preset.'} action={!archived && shows.length ? <Button onClick={() => setCreateOpen(true)}>Crear desde show</Button> : undefined} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((preset) => <article key={preset.id} className="panel p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-semibold">{preset.name}</h2><div className="mt-2 flex flex-wrap gap-2">{preset.showType && <Badge>{preset.showType}</Badge>}{preset.archived && <Badge>Archivado</Badge>}</div></div><Layers size={20} className="muted" /></div><p className="mt-3 min-h-10 text-sm muted">{preset.description || 'Sin descripción.'}</p><div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--panel-2)] p-3 text-center"><div><strong className="block text-sm">{preset.equipment.length}</strong><span className="text-[10px] uppercase tracking-wide muted">Equipo</span></div><div><strong className="block text-sm">{preset.people.length}</strong><span className="text-[10px] uppercase tracking-wide muted">Personas</span></div><div><strong className="block text-sm">{preset.schedule.length}</strong><span className="text-[10px] uppercase tracking-wide muted">Horarios</span></div></div><div className="mt-4 flex flex-wrap gap-1 border-t border-[var(--line)] pt-3">{!preset.archived && <Button size="sm" onClick={() => setApplyId(preset.id)}>Aplicar</Button>}<Button variant="ghost" size="icon" onClick={() => setEditingId(preset.id)} aria-label="Editar"><Edit3 size={14} /></Button><Button variant="ghost" size="icon" onClick={() => duplicatePreset(preset.id)} aria-label="Duplicar"><Copy size={14} /></Button><Button variant="ghost" size="icon" onClick={() => archivePreset(preset.id, !preset.archived)} aria-label={preset.archived ? 'Restaurar' : 'Archivar'}>{preset.archived ? <RotateCcw size={14} /> : <Archive size={14} />}</Button><Button variant="danger" size="icon" onClick={() => deletePreset(preset.id)} aria-label="Eliminar"><Trash2 size={14} /></Button></div></article>)}</div>}

    <CreatePresetModal open={createOpen} onClose={() => setCreateOpen(false)} shows={shows} onCreate={(showId, name) => { createPresetFromShow(showId, name); setCreateOpen(false) }} />
    {editing && <EditPresetModal open onClose={() => setEditingId(undefined)} preset={editing} onSave={(patch) => { updatePreset(editing.id, patch); setEditingId(undefined) }} />}
    {applying && <ApplyToShowModal open onClose={() => setApplyId(undefined)} presetName={applying.name} shows={shows} onApply={(showId, mode) => { applyPreset(showId, applying.id, mode); setApplyId(undefined) }} />}
  </>
}

function CreatePresetModal({ open, onClose, shows, onCreate }: { open: boolean; onClose: () => void; shows: { id: string; name: string }[]; onCreate: (showId: string, name?: string) => void }) {
  const [showId, setShowId] = useState('')
  const [name, setName] = useState('')
  return <Modal open={open} title="Crear preset desde show" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!showId} onClick={() => onCreate(showId, name.trim() || undefined)}>Crear</Button></>}><div className="space-y-4"><Field label="Show de origen"><Select value={showId} onChange={(event) => { setShowId(event.target.value); const show = shows.find((item) => item.id === event.target.value); if (show) setName(`${show.name} — preset`) }}><option value="">Selecciona un show</option>{shows.map((show) => <option key={show.id} value={show.id}>{show.name}</option>)}</Select></Field><Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del preset" /></Field><p className="text-xs muted">Se copiarán categorías, equipo, personas, horarios, tipo y nota. El estado de verificación del equipo se reinicia.</p></div></Modal>
}

function EditPresetModal({ open, onClose, preset, onSave }: { open: boolean; onClose: () => void; preset: { name: string; description?: string; showType?: string; note?: string }; onSave: (patch: { name: string; description?: string; showType?: string; note?: string }) => void }) {
  const [name, setName] = useState(preset.name)
  const [description, setDescription] = useState(preset.description || '')
  const [showType, setShowType] = useState(preset.showType || '')
  const [note, setNote] = useState(preset.note || '')
  return <Modal open={open} title="Editar preset" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), description: description.trim() || undefined, showType: showType.trim() || undefined, note: note.trim() || undefined })}>Guardar</Button></>}><div className="space-y-4"><Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Descripción"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field><Field label="Tipo de show"><Input value={showType} onChange={(event) => setShowType(event.target.value)} /></Field><Field label="Nota base"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field></div></Modal>
}

function ApplyToShowModal({ open, onClose, presetName, shows, onApply }: { open: boolean; onClose: () => void; presetName: string; shows: { id: string; name: string }[]; onApply: (showId: string, mode: 'merge' | 'replace') => void }) {
  const [showId, setShowId] = useState('')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  return <Modal open={open} title={`Aplicar “${presetName}”`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!showId} onClick={() => onApply(showId, mode)}>Aplicar</Button></>}><div className="space-y-4"><Field label="Show de destino"><Select value={showId} onChange={(event) => setShowId(event.target.value)}><option value="">Selecciona un show</option>{shows.map((show) => <option key={show.id} value={show.id}>{show.name}</option>)}</Select></Field><Field label="Modo"><Select value={mode} onChange={(event) => setMode(event.target.value as 'merge' | 'replace')}><option value="merge">Fusionar con el contenido actual</option><option value="replace">Reemplazar Equipo, Personas y Horarios</option></Select></Field></div></Modal>
}
