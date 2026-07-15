import { Archive, Calendar, Clock, Copy, MoreHorizontal, Plus, RotateCcw, Trash2, Users } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { formatDate, formatTime } from '../lib/utils'
import { Badge, Button, EmptyState, Input, Label, Modal, PageHeader, ProgressBar, SearchInput, Select } from '../components/ui'
import { useToast } from '../components/Toast'

export default function ShowsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const shows = useAppStore((state) => state.shows)
  const presets = useAppStore((state) => state.presets)
  const preferences = useAppStore((state) => state.preferences)
  const createShow = useAppStore((state) => state.createShow)
  const duplicateShow = useAppStore((state) => state.duplicateShow)
  const updateShow = useAppStore((state) => state.updateShow)
  const archiveShow = useAppStore((state) => state.archiveShow)
  const deleteShow = useAppStore((state) => state.deleteShow)
  const restoreShow = useAppStore((state) => state.restoreShow)
  const [archived, setArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [menuId, setMenuId] = useState<string>()

  const filtered = useMemo(() => shows
    .filter((show) => show.archived === archived)
    .filter((show) => `${show.name} ${show.showType || ''} ${show.date || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => {
      if (!a.date && !b.date) return b.updatedAt.localeCompare(a.updatedAt)
      if (!a.date) return 1
      if (!b.date) return -1
      return archived ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    }), [shows, archived, search])

  const handleDelete = (id: string) => {
    const removed = deleteShow(id)
    setMenuId(undefined)
    if (removed) showToast('Show eliminado', { onAction: () => restoreShow(removed) })
  }

  return (
    <>
      <PageHeader title="Shows" description="Prepara, consulta y archiva cada show desde un solo lugar." actions={<Button onClick={() => setCreateOpen(true)}><Plus size={17} />Nuevo show</Button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, tipo o fecha…" />
        <div className="flex rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1">
          <button className={`rounded-lg px-4 py-2 text-sm font-medium ${!archived ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`} onClick={() => setArchived(false)}>Activos</button>
          <button className={`rounded-lg px-4 py-2 text-sm font-medium ${archived ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted'}`} onClick={() => setArchived(true)}>Archivados</button>
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title={archived ? 'No hay shows archivados' : 'Crea tu primer show'} description={archived ? 'Los shows que archives aparecerán aquí.' : 'Crea primero y configura después. Entrarás directamente al espacio de trabajo del show.'} action={!archived ? <Button onClick={() => setCreateOpen(true)}><Plus size={17} />Nuevo show</Button> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((show) => {
            const total = show.equipment.length
            const checked = show.equipment.filter((item) => item.checked).length
            const progress = total ? Math.round((checked / total) * 100) : 0
            return (
              <article key={show.id} className="panel group relative overflow-visible p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <button className="absolute inset-0 rounded-2xl" aria-label={`Abrir ${show.name}`} onClick={() => navigate(`/shows/${show.id}`)} />
                <div className="relative pointer-events-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{show.name}</h2><div className="mt-2 flex flex-wrap gap-2">{show.showType && <Badge>{show.showType}</Badge>}{show.archived && <Badge>Archivado</Badge>}</div></div>
                    <div className="pointer-events-auto relative">
                      <Button variant="ghost" size="icon" onClick={() => setMenuId(menuId === show.id ? undefined : show.id)} aria-label="Más acciones"><MoreHorizontal size={18} /></Button>
                      {menuId === show.id && <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 shadow-xl">
                        {!show.archived && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--panel-2)]" onClick={() => { const id = duplicateShow(show.id); setMenuId(undefined); if (id) navigate(`/shows/${id}`) }}><Copy size={15} />Duplicar</button>}
                        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--panel-2)]" onClick={() => { archiveShow(show.id, !show.archived); setMenuId(undefined) }}>{show.archived ? <RotateCcw size={15} /> : <Archive size={15} />}{show.archived ? 'Restaurar' : 'Archivar'}</button>
                        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--panel-2)]" onClick={() => handleDelete(show.id)}><Trash2 size={15} />Eliminar</button>
                      </div>}
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 muted"><Calendar size={15} />{formatDate(show.date, preferences.dateFormat)}</div>
                    <div className="flex items-center gap-2 muted"><Clock size={15} />{formatTime(show.time, preferences.timeFormat)}</div>
                    <div className="flex items-center gap-2 muted"><Users size={15} />{show.people.length} persona{show.people.length === 1 ? '' : 's'}</div>
                    <div className="text-right text-xs font-medium muted">{checked}/{total} equipo</div>
                  </div>
                  <div className="mt-3"><ProgressBar value={progress} /></div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <CreateShowModal open={createOpen} onClose={() => setCreateOpen(false)} shows={shows.filter((item) => !item.archived)} presets={presets.filter((item) => !item.archived)} onCreate={(data) => {
        let id: string | undefined
        if (data.source.startsWith('show:')) {
          id = duplicateShow(data.source.slice(5))
          if (id) updateShow(id, { name: data.name, date: data.date || undefined, time: data.time || undefined, showType: data.showType || undefined })
        } else {
          id = createShow({ name: data.name, date: data.date || undefined, time: data.time || undefined, showType: data.showType || undefined }, data.source.startsWith('preset:') ? data.source.slice(7) : undefined)
        }
        setCreateOpen(false)
        if (id) navigate(`/shows/${id}`)
      }} />
    </>
  )
}

function CreateShowModal({ open, onClose, shows, presets, onCreate }: { open: boolean; onClose: () => void; shows: { id: string; name: string }[]; presets: { id: string; name: string }[]; onCreate: (data: { name: string; date: string; time: string; showType: string; source: string }) => void }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [showType, setShowType] = useState('')
  const [source, setSource] = useState('blank')
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim()) onCreate({ name: name.trim(), date, time, showType, source }) }
  return <Modal open={open} title="Nuevo show" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="create-show" disabled={!name.trim()}>Crear y abrir</Button></>}>
    <form id="create-show" onSubmit={submit} className="space-y-4">
      <div><Label>Nombre *</Label><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. TABU — Foro Indie Rocks" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><Label>Fecha</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div><Label>Hora</Label><Input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></div></div>
      <div><Label>Tipo de show</Label><Input value={showType} onChange={(event) => setShowType(event.target.value)} placeholder="Concierto, festival, showcase…" /></div>
      <div><Label>Comenzar desde</Label><Select value={source} onChange={(event) => setSource(event.target.value)}><option value="blank">Show vacío</option>{presets.length > 0 && <optgroup label="Presets">{presets.map((item) => <option key={item.id} value={`preset:${item.id}`}>{item.name}</option>)}</optgroup>}{shows.length > 0 && <optgroup label="Shows anteriores">{shows.map((item) => <option key={item.id} value={`show:${item.id}`}>{item.name}</option>)}</optgroup>}</Select></div>
      <p className="text-xs muted">El show se crea inmediatamente. Después podrás editar Equipo, Personas e Información sin pasos intermedios.</p>
    </form>
  </Modal>
}
