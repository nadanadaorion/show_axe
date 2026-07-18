import { Archive, ChevronDown, ChevronUp, Edit3, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useAppStore, type LibrarySection } from '../store'
import type { CatalogItem, Category, EquipmentLibraryItem, PersonLibraryItem } from '../types'
import { Badge, Button, EmptyState, Field, Input, Label, Modal, PageHeader, SearchInput, Select, Textarea } from '../components/ui'

const sections: { key: LibrarySection; label: string; description: string }[] = [
  { key: 'equipment', label: 'Equipo', description: 'Recursos reutilizables para agregar a cualquier show.' },
  { key: 'people', label: 'Personas', description: 'Contactos reutilizables con funciones y datos múltiples.' },
  { key: 'categories', label: 'Categorías', description: 'Categorías base copiadas al crear un show.' },
  { key: 'roles', label: 'Funciones', description: 'Funciones que puede desempeñar una persona.' },
  { key: 'personTypes', label: 'Tipos de persona', description: 'Clasificaciones como equipo, proveedor o venue.' },
  { key: 'origins', label: 'Orígenes', description: 'Procedencia del equipo: propio, renta, venue, etc.' },
]

type LibraryItem = CatalogItem | Category | EquipmentLibraryItem | PersonLibraryItem

export default function LibraryPage() {
  const library = useAppStore((state) => state.library)
  const addLibraryItem = useAppStore((state) => state.addLibraryItem)
  const updateLibraryItem = useAppStore((state) => state.updateLibraryItem)
  const deleteLibraryItem = useAppStore((state) => state.deleteLibraryItem)
  const [section, setSection] = useState<LibrarySection>('equipment')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<LibraryItem | null | undefined>(undefined)

  const currentSection = sections.find((item) => item.key === section)!
  const items = useMemo(() => (library[section] as LibraryItem[])
    .filter((item) => Boolean(item.archived) === showArchived)
    .filter((item) => `${item.name} ${item.notes || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => section === 'categories' ? ((a as Category).order || 0) - ((b as Category).order || 0) : a.name.localeCompare(b.name)), [library, section, search, showArchived])

  const moveCategory = (item: Category, direction: -1 | 1) => {
    const ordered = [...library.categories].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex((entry) => entry.id === item.id)
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    updateLibraryItem('categories', ordered[index].id, { order: target })
    updateLibraryItem('categories', ordered[target].id, { order: index })
  }

  return <>
    <PageHeader title="Biblioteca" description="Todo dato reutilizable vive aquí. Los cambios nunca modifican shows existentes." actions={<Button onClick={() => setEditing(null)}><Plus size={16} />Nuevo</Button>} />
    <div className="mb-5 overflow-x-auto"><div className="flex min-w-max gap-1 border-2 border-[var(--strong-line)] bg-[var(--panel)] p-1">{sections.map((item) => <button key={item.key} onClick={() => { setSection(item.key); setSearch('') }} className={`min-h-10 px-3 py-2 text-xs font-bold uppercase tracking-[.08em] ${section === item.key ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'muted hover:bg-[var(--panel-2)] hover:text-[var(--text)]'}`}>{item.label}</button>)}</div></div>
    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]"><SearchInput value={search} onChange={setSearch} placeholder={`Buscar ${currentSection.label.toLocaleLowerCase()}…`} /><div className="flex border-2 border-[var(--strong-line)] bg-[var(--panel)] p-1"><button onClick={() => setShowArchived(false)} className={`px-3 py-2 font-mono text-[10px] font-bold uppercase ${!showArchived ? 'bg-[var(--accent)] text-white' : 'muted'}`}>Activos</button><button onClick={() => setShowArchived(true)} className={`px-3 py-2 font-mono text-[10px] font-bold uppercase ${showArchived ? 'bg-[var(--accent)] text-white' : 'muted'}`}>Archivados</button></div></div>
    <div className="mb-5 border-l-4 border-[var(--accent)] bg-[var(--panel-2)] px-4 py-3 font-mono text-xs muted">{currentSection.description}</div>

    {!items.length ? <EmptyState title={showArchived ? 'No hay elementos archivados' : `No hay ${currentSection.label.toLocaleLowerCase()}`} description="Crea un elemento para poder reutilizarlo al preparar nuevos shows." action={!showArchived ? <Button onClick={() => setEditing(null)}>Crear elemento</Button> : undefined} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="panel p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{item.name}</h2><ItemSummary section={section} item={item} library={library} /></div>{item.archived && <Badge>Archivado</Badge>}</div>{item.notes && <p className="mt-3 line-clamp-2 text-sm muted">{item.notes}</p>}<div className="mt-4 flex flex-wrap gap-1 border-t border-[var(--line)] pt-3"><Button variant="ghost" size="sm" onClick={() => setEditing(item)}><Edit3 size={14} />Editar</Button>{section === 'categories' && !item.archived && <><Button variant="ghost" size="icon" onClick={() => moveCategory(item as Category, -1)}><ChevronUp size={14} /></Button><Button variant="ghost" size="icon" onClick={() => moveCategory(item as Category, 1)}><ChevronDown size={14} /></Button></>}<Button variant="ghost" size="sm" onClick={() => updateLibraryItem(section, item.id, { archived: !item.archived })}>{item.archived ? <RotateCcw size={14} /> : <Archive size={14} />}{item.archived ? 'Restaurar' : 'Archivar'}</Button><Button variant="danger" size="icon" onClick={() => deleteLibraryItem(section, item.id)} aria-label="Eliminar"><Trash2 size={14} /></Button></div></article>)}</div>}

    <LibraryItemModal key={`${section}-${editing?.id || 'new'}-${editing === undefined ? 'closed' : 'open'}`} open={editing !== undefined} section={section} item={editing || undefined} library={library} onClose={() => setEditing(undefined)} onSave={(data) => { if (editing) updateLibraryItem(section, editing.id, data); else addLibraryItem(section, data); setEditing(undefined) }} />
  </>
}

function ItemSummary({ section, item, library }: { section: LibrarySection; item: LibraryItem; library: ReturnType<typeof useAppStore.getState>['library'] }) {
  if (section === 'equipment') {
    const equipment = item as EquipmentLibraryItem
    return <div className="mt-1 text-xs muted">{library.categories.find((category) => category.id === equipment.categoryId)?.name || 'Sin categoría'} · {equipment.unit || 'Sin unidad'} · {library.origins.find((origin) => origin.id === equipment.originId)?.name || 'Sin origen'}</div>
  }
  if (section === 'people') {
    const person = item as PersonLibraryItem
    return <div className="mt-1 text-xs muted">{person.company || 'Sin empresa'} · {person.roleIds.length} función{person.roleIds.length === 1 ? '' : 'es'}</div>
  }
  if (section === 'categories') return <div className="mt-1 text-xs muted">Orden {(item as Category).order + 1}</div>
  return <div className="mt-1 text-xs muted">Catálogo reutilizable</div>
}

function LibraryItemModal({ open, section, item, library, onClose, onSave }: { open: boolean; section: LibrarySection; item?: LibraryItem; library: ReturnType<typeof useAppStore.getState>['library']; onClose: () => void; onSave: (data: Record<string, unknown>) => void }) {
  const [name, setName] = useState(item?.name || '')
  const [notes, setNotes] = useState(item?.notes || '')
  const equipment = item as EquipmentLibraryItem | undefined
  const person = item as PersonLibraryItem | undefined
  const [categoryId, setCategoryId] = useState(equipment?.categoryId || '')
  const [unit, setUnit] = useState(equipment?.unit || '')
  const [originId, setOriginId] = useState(equipment?.originId || '')
  const [company, setCompany] = useState(person?.company || '')
  const [roleIds, setRoleIds] = useState<string[]>(person?.roleIds || [])
  const [typeIds, setTypeIds] = useState<string[]>(person?.typeIds || [])
  const [phones, setPhones] = useState((person?.phones || []).join('\n'))
  const [emails, setEmails] = useState((person?.emails || []).join('\n'))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const base: Record<string, unknown> = { name: name.trim(), notes: notes.trim() || undefined }
    if (section === 'equipment') Object.assign(base, { categoryId: categoryId || undefined, unit: unit.trim() || undefined, originId: originId || undefined })
    if (section === 'people') Object.assign(base, { company: company.trim() || undefined, roleIds, typeIds, phones: phones.split('\n').map((value) => value.trim()).filter(Boolean), emails: emails.split('\n').map((value) => value.trim()).filter(Boolean) })
    onSave(base)
  }

  return <Modal open={open} title={`${item ? 'Editar' : 'Nuevo'} ${sections.find((entry) => entry.key === section)?.label.toLocaleLowerCase()}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="library-item" disabled={!name.trim()}>Guardar</Button></>}><form id="library-item" onSubmit={submit} className="space-y-4"><Field label="Nombre *"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></Field>
    {section === 'equipment' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Categoría"><Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sin categoría</option>{library.categories.filter((category) => !category.archived).sort((a, b) => a.order - b.order).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field><Field label="Unidad"><Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="pzas, metros, kits…" /></Field><div className="sm:col-span-2"><Field label="Origen predeterminado"><Select value={originId} onChange={(event) => setOriginId(event.target.value)}><option value="">Sin origen</option>{library.origins.filter((origin) => !origin.archived).map((origin) => <option key={origin.id} value={origin.id}>{origin.name}</option>)}</Select></Field></div></div>}
    {section === 'people' && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Empresa"><Input value={company} onChange={(event) => setCompany(event.target.value)} /></Field></div><div><Label>Tipos</Label><MultiSelect items={library.personTypes.filter((entry) => !entry.archived)} selected={typeIds} onChange={setTypeIds} /></div><div><Label>Funciones</Label><MultiSelect items={library.roles.filter((entry) => !entry.archived)} selected={roleIds} onChange={setRoleIds} /></div><Field label="Teléfonos"><Textarea value={phones} onChange={(event) => setPhones(event.target.value)} placeholder="Uno por línea" /></Field><Field label="Correos"><Textarea value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="Uno por línea" /></Field></div>}
    <Field label="Notas"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></form></Modal>
}

function MultiSelect({ items, selected, onChange }: { items: CatalogItem[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--panel-2)]"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onChange(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} />{item.name}</label>)}{!items.length && <div className="p-2 text-xs muted">No hay opciones en la Biblioteca.</div>}</div>
}
