import { create } from 'zustand'
import { db, saveBackup, writeLocalSnapshot } from './lib/db'
import { clone, createPublicSlug, now, uid } from './lib/utils'
import { normalizeAssignments, normalizeEquipmentItem, normalizeInputList } from './lib/inputList'
import { queueShowDelete, queueShowUpsert, queueWorkspaceUpsert } from './lib/syncQueue'
import { classifyRemoteShowRevision, type RemoteShowApplyResult } from './lib/showRevision'
import type {
  AppSnapshot,
  CatalogItem,
  Category,
  EquipmentLibraryItem,
  Library,
  PersonLibraryItem,
  Preferences,
  Preset,
  ScheduleItem,
  Show,
  ShowEquipmentCategory,
  ShowEquipmentItem,
  ShowPerson,
  WorkspaceData,
} from './types'

export type LibrarySection = keyof Library
export type ImportMode = 'merge' | 'replace'
export type PresetApplyMode = 'merge' | 'replace'

const timestamp = now()
const defaults: Preferences = {
  dateFormat: 'dd/MM/yyyy',
  timeFormat: '24h',
  language: 'es',
  initialModule: 'shows',
  theme: 'system',
  showInputListWarnings: true,
}

const seedLibrary: Library = {
  categories: [
    { id: 'cat-audio', name: 'Audio', order: 0, createdAt: timestamp, updatedAt: timestamp },
    { id: 'cat-backline', name: 'Backline', order: 1, createdAt: timestamp, updatedAt: timestamp },
    { id: 'cat-lighting', name: 'Iluminación', order: 2, createdAt: timestamp, updatedAt: timestamp },
    { id: 'cat-visuals', name: 'Visuales', order: 3, createdAt: timestamp, updatedAt: timestamp },
    { id: 'cat-other', name: 'Otros', order: 4, createdAt: timestamp, updatedAt: timestamp },
  ],
  roles: [
    { id: 'role-artist', name: 'Artista', createdAt: timestamp, updatedAt: timestamp },
    { id: 'role-manager', name: 'Manager', createdAt: timestamp, updatedAt: timestamp },
    { id: 'role-audio', name: 'Audio', createdAt: timestamp, updatedAt: timestamp },
    { id: 'role-production', name: 'Producción', createdAt: timestamp, updatedAt: timestamp },
  ],
  personTypes: [
    { id: 'type-team', name: 'Equipo', createdAt: timestamp, updatedAt: timestamp },
    { id: 'type-provider', name: 'Proveedor', createdAt: timestamp, updatedAt: timestamp },
    { id: 'type-venue', name: 'Venue', createdAt: timestamp, updatedAt: timestamp },
  ],
  origins: [
    { id: 'origin-own', name: 'Propio', createdAt: timestamp, updatedAt: timestamp },
    { id: 'origin-rental', name: 'Renta', createdAt: timestamp, updatedAt: timestamp },
    { id: 'origin-venue', name: 'Venue', createdAt: timestamp, updatedAt: timestamp },
  ],
  equipment: [],
  people: [],
}

interface CreateShowInput {
  name: string
  date?: string
  time?: string
  showType?: string
}

interface StoreState {
  ready: boolean
  shows: Show[]
  presets: Preset[]
  library: Library
  preferences: Preferences
  initialize: () => Promise<void>
  createShow: (input: CreateShowInput, presetId?: string) => string
  duplicateShow: (id: string) => string | undefined
  updateShow: (id: string, patch: Partial<Show>) => void
  archiveShow: (id: string, archived: boolean) => void
  deleteShow: (id: string) => Show | undefined
  restoreShow: (show: Show) => void
  addShowCategory: (showId: string, name: string) => string
  updateShowCategory: (showId: string, categoryId: string, patch: Partial<ShowEquipmentCategory>) => void
  moveShowCategory: (showId: string, categoryId: string, direction: -1 | 1) => void
  deleteShowCategory: (showId: string, categoryId: string) => void
  addEquipment: (showId: string, input: Partial<ShowEquipmentItem> & { name: string }, libraryId?: string) => string | undefined
  updateEquipment: (showId: string, itemId: string, patch: Partial<ShowEquipmentItem>) => void
  duplicateEquipment: (showId: string, itemId: string) => void
  deleteEquipment: (showId: string, itemId: string) => ShowEquipmentItem | undefined
  restoreEquipment: (showId: string, item: ShowEquipmentItem) => void
  moveEquipment: (showId: string, itemId: string, categoryId: string, order?: number) => void
  addPerson: (showId: string, input: Partial<ShowPerson> & { name: string }, libraryId?: string) => string | undefined
  updatePerson: (showId: string, personId: string, patch: Partial<ShowPerson>) => void
  deletePerson: (showId: string, personId: string) => ShowPerson | undefined
  restorePerson: (showId: string, person: ShowPerson) => void
  addSchedule: (showId: string, input: Partial<ScheduleItem> & { name: string; startTime: string }) => string
  updateSchedule: (showId: string, itemId: string, patch: Partial<ScheduleItem>) => void
  deleteSchedule: (showId: string, itemId: string) => void
  addLibraryItem: (section: LibrarySection, input: Record<string, unknown>) => string
  updateLibraryItem: (section: LibrarySection, id: string, patch: Record<string, unknown>) => void
  deleteLibraryItem: (section: LibrarySection, id: string) => void
  createPresetFromShow: (showId: string, name?: string) => string | undefined
  duplicatePreset: (id: string) => void
  updatePreset: (id: string, patch: Partial<Preset>) => void
  archivePreset: (id: string, archived: boolean) => void
  deletePreset: (id: string) => void
  applyPreset: (showId: string, presetId: string, mode: PresetApplyMode) => void
  updatePreferences: (patch: Partial<Preferences>) => void
  snapshot: () => AppSnapshot
  importSnapshot: (snapshot: AppSnapshot, mode: ImportMode) => void
  createBackup: (reason: string) => Promise<void>
  applyRemoteShow: (show: Show, revision: number) => Promise<RemoteShowApplyResult>
  removeRemoteShow: (showId: string) => Promise<void>
  applyRemoteWorkspace: (workspace: WorkspaceData, revision: number) => Promise<void>
}

let persistTimer: ReturnType<typeof setTimeout> | undefined

function makeSnapshot(state: Pick<StoreState, 'shows' | 'presets' | 'library' | 'preferences'>): AppSnapshot {
  return {
    version: 3,
    exportedAt: now(),
    shows: clone(state.shows),
    presets: clone(state.presets),
    library: clone(state.library),
    preferences: clone(state.preferences),
  }
}

async function writeSnapshot(snapshot: AppSnapshot) {
  await writeLocalSnapshot(snapshot)

  const lastBackup = Number(localStorage.getItem('orion-shows:last-auto-backup') || 0)
  if (Date.now() - lastBackup > 15 * 60 * 1000) {
    await saveBackup({ id: uid(), createdAt: now(), reason: 'Automático', snapshot })
    localStorage.setItem('orion-shows:last-auto-backup', String(Date.now()))
  }
}

function schedulePersist(get: () => StoreState) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => void writeSnapshot(makeSnapshot(get())), 250)
}

function activeCategories(library: Library): ShowEquipmentCategory[] {
  return library.categories
    .filter((item) => !item.archived)
    .sort((a, b) => a.order - b.order)
    .map((item, order) => ({ id: uid(), name: item.name, order }))
}

function sortSchedule(items: ScheduleItem[]) {
  return [...items]
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order)
    .map((item, order) => ({ ...item, order }))
}

function remapPreset(preset: Preset) {
  const categoryMap = new Map<string, string>()
  const categories = preset.equipmentCategories.map((category, order) => {
    const id = uid()
    categoryMap.set(category.id, id)
    return { ...category, id, order }
  })
  return {
    categories,
    equipment: preset.equipment.map((item, order) => ({
      ...item,
      id: uid(),
      categoryId: categoryMap.get(item.categoryId) || categories[0]?.id || uid(),
      assignments: normalizeAssignments(item.assignments, item.quantity).map((assignment) => ({ ...assignment, id: uid() })),
      order,
    })),
    people: preset.people.map((person, order) => ({ ...person, id: uid(), order })),
    schedule: preset.schedule.map((item, order) => ({ ...item, id: uid(), order })),
  }
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const map = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}

function normalizeShow(show: Show): Show {
  return {
    ...show,
    publicSlug: show.publicSlug || createPublicSlug(),
    equipment: (show.equipment || []).map(normalizeEquipmentItem),
    people: show.people || [],
    schedule: show.schedule || [],
    equipmentCategories: show.equipmentCategories || [],
    inputList: normalizeInputList(show.inputList),
  }
}

function normalizePreset(preset: Preset): Preset {
  return {
    ...preset,
    equipment: (preset.equipment || []).map(normalizeEquipmentItem),
    people: preset.people || [],
    schedule: preset.schedule || [],
    equipmentCategories: preset.equipmentCategories || [],
  }
}

function normalizePreferences(preferences: Partial<Preferences> | undefined): Preferences {
  return { ...defaults, ...(preferences || {}), showInputListWarnings: preferences?.showInputListWarnings !== false }
}

function workspaceFromState(state: Pick<StoreState, 'presets' | 'library' | 'preferences'>): WorkspaceData {
  return { presets: clone(state.presets), library: clone(state.library), preferences: clone(state.preferences) }
}

let suppressRemoteQueue = 0
let remoteShowApplyChain: Promise<unknown> = Promise.resolve()

function serializeRemoteShowApplication(work: () => Promise<RemoteShowApplyResult>) {
  const next = remoteShowApplyChain.then(work, work)
  remoteShowApplyChain = next.then(() => undefined, () => undefined)
  return next
}

export const useAppStore = create<StoreState>((set, get) => {
  const commit = (updater: (state: StoreState) => Partial<StoreState>) => {
    const previous = get()
    set((state) => updater(state))
    const current = get()
    schedulePersist(get)

    if (suppressRemoteQueue > 0) return
    if (previous.shows !== current.shows) {
      const before = new Map(previous.shows.map((show) => [show.id, show]))
      const after = new Map(current.shows.map((show) => [show.id, show]))
      for (const show of current.shows) {
        if (before.get(show.id) !== show) void queueShowUpsert(show)
      }
      for (const show of previous.shows) {
        if (!after.has(show.id)) void queueShowDelete(show.id)
      }
    }
    if (previous.presets !== current.presets || previous.library !== current.library || previous.preferences !== current.preferences) {
      void queueWorkspaceUpsert(workspaceFromState(current))
    }
  }

  const updateShowInternal = (showId: string, fn: (show: Show) => Show) => {
    commit((state) => ({
      shows: state.shows.map((show) => (show.id === showId ? fn(show) : show)),
    }))
  }

  return {
    ready: false,
    shows: [],
    presets: [],
    library: seedLibrary,
    preferences: defaults,

    initialize: async () => {
      const [shows, presets, equipment, people, categories, roles, personTypes, origins, preference] = await Promise.all([
        db.shows.toArray(),
        db.presets.toArray(),
        db.equipmentLibrary.toArray(),
        db.peopleLibrary.toArray(),
        db.categories.toArray(),
        db.roles.toArray(),
        db.personTypes.toArray(),
        db.origins.toArray(),
        db.preferences.get('main'),
      ])
      const hasData =
        shows.length || presets.length || equipment.length || people.length || categories.length || roles.length || personTypes.length || origins.length
      set({
        ready: true,
        shows: shows.map(normalizeShow),
        presets: presets.map(normalizePreset),
        library: hasData
          ? { equipment, people, categories, roles, personTypes, origins }
          : clone(seedLibrary),
        preferences: normalizePreferences(preference),
      })
      if (!hasData) await writeSnapshot(makeSnapshot(get()))
    },

    createShow: (input, presetId) => {
      const id = uid()
      const createdAt = now()
      const preset = get().presets.find((item) => item.id === presetId)
      const mapped = preset ? remapPreset(preset) : undefined
      const show: Show = {
        id,
        publicSlug: createPublicSlug(),
        name: input.name.trim() || 'Show sin nombre',
        date: input.date,
        time: input.time,
        showType: input.showType || preset?.showType,
        note: preset?.note,
        archived: false,
        equipmentCategories: mapped?.categories || activeCategories(get().library),
        equipment: mapped?.equipment || [],
        people: mapped?.people || [],
        schedule: mapped?.schedule || [],
        inputList: undefined,
        createdAt,
        updatedAt: createdAt,
      }
      commit((state) => ({ shows: [show, ...state.shows] }))
      return id
    },

    duplicateShow: (id) => {
      const source = get().shows.find((show) => show.id === id)
      if (!source) return undefined
      const newId = uid()
      const createdAt = now()
      const categoryMap = new Map<string, string>()
      const equipmentCategories = source.equipmentCategories.map((category) => {
        const categoryId = uid()
        categoryMap.set(category.id, categoryId)
        return { ...category, id: categoryId }
      })
      const equipmentMap = new Map<string, string>()
      const assignmentMap = new Map<string, string>()
      const equipment = source.equipment.map((item) => {
        const equipmentId = uid()
        equipmentMap.set(item.id, equipmentId)
        const assignments = normalizeAssignments(item.assignments, item.quantity).map((assignment) => {
          const assignmentId = uid()
          assignmentMap.set(assignment.id, assignmentId)
          return { ...assignment, id: assignmentId }
        })
        return {
          ...clone(item),
          id: equipmentId,
          categoryId: categoryMap.get(item.categoryId) || equipmentCategories[0]?.id,
          assignments,
        }
      })
      const inputList = source.inputList
        ? {
            ...clone(source.inputList),
            rows: source.inputList.rows.map((row) => ({
              ...clone(row),
              id: uid(),
              sourceEquipmentId: row.sourceEquipmentId ? equipmentMap.get(row.sourceEquipmentId) : undefined,
              sourceAssignmentId: row.sourceAssignmentId ? assignmentMap.get(row.sourceAssignmentId) : undefined,
            })),
            returns: source.inputList.returns.map((item) => ({ ...clone(item), id: uid() })),
            createdAt,
            updatedAt: createdAt,
          }
        : undefined
      const copy: Show = {
        ...clone(source),
        id: newId,
        publicSlug: createPublicSlug(),
        name: `${source.name} — copia`,
        archived: false,
        equipmentCategories,
        equipment,
        people: source.people.map((item) => ({ ...clone(item), id: uid() })),
        schedule: source.schedule.map((item) => ({ ...clone(item), id: uid() })),
        inputList,
        createdAt,
        updatedAt: createdAt,
      }
      commit((state) => ({ shows: [copy, ...state.shows] }))
      return newId
    },

    updateShow: (id, patch) =>
      updateShowInternal(id, (show) => ({ ...show, ...patch, id: show.id, updatedAt: now() })),

    archiveShow: (id, archived) =>
      updateShowInternal(id, (show) => ({ ...show, archived, updatedAt: now() })),

    deleteShow: (id) => {
      const show = get().shows.find((item) => item.id === id)
      if (show) commit((state) => ({ shows: state.shows.filter((item) => item.id !== id) }))
      return show ? clone(show) : undefined
    },

    restoreShow: (show) => commit((state) => ({ shows: [normalizeShow(show), ...state.shows.filter((item) => item.id !== show.id)] })),

    addShowCategory: (showId, name) => {
      const id = uid()
      updateShowInternal(showId, (show) => ({
        ...show,
        equipmentCategories: [...show.equipmentCategories, { id, name: name.trim() || 'Nueva categoría', order: show.equipmentCategories.length }],
        updatedAt: now(),
      }))
      return id
    },

    updateShowCategory: (showId, categoryId, patch) =>
      updateShowInternal(showId, (show) => ({
        ...show,
        equipmentCategories: show.equipmentCategories.map((category) => (category.id === categoryId ? { ...category, ...patch, id: category.id } : category)),
        updatedAt: now(),
      })),

    moveShowCategory: (showId, categoryId, direction) =>
      updateShowInternal(showId, (show) => {
        const ordered = [...show.equipmentCategories].sort((a, b) => a.order - b.order)
        const index = ordered.findIndex((category) => category.id === categoryId)
        const target = index + direction
        if (index < 0 || target < 0 || target >= ordered.length) return show
        ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
        return { ...show, equipmentCategories: ordered.map((category, order) => ({ ...category, order })), updatedAt: now() }
      }),

    deleteShowCategory: (showId, categoryId) =>
      updateShowInternal(showId, (show) => {
        if (show.equipmentCategories.length <= 1) return show
        const categories = show.equipmentCategories.filter((item) => item.id !== categoryId).map((item, order) => ({ ...item, order }))
        const fallback = categories[0].id
        return {
          ...show,
          equipmentCategories: categories,
          equipment: show.equipment.map((item) => (item.categoryId === categoryId ? { ...item, categoryId: fallback } : item)),
          updatedAt: now(),
        }
      }),

    addEquipment: (showId, input, libraryId) => {
      const show = get().shows.find((item) => item.id === showId)
      if (!show) return undefined
      const source = libraryId ? get().library.equipment.find((item) => item.id === libraryId) : undefined
      let categoryId = input.categoryId
      if (!categoryId && source?.categoryId) {
        const libraryCategory = get().library.categories.find((item) => item.id === source.categoryId)
        categoryId = show.equipmentCategories.find((item) => item.name.toLocaleLowerCase() === libraryCategory?.name.toLocaleLowerCase())?.id
      }
      categoryId ||= show.equipmentCategories[0]?.id
      if (!categoryId) categoryId = get().addShowCategory(showId, 'Equipo')
      const id = uid()
      const origin = source?.originId ? get().library.origins.find((item) => item.id === source.originId)?.name : undefined
      const item: ShowEquipmentItem = {
        id,
        sourceLibraryId: libraryId,
        categoryId,
        name: (input.name || source?.name || '').trim() || 'Equipo sin nombre',
        quantity: input.quantity ?? 1,
        unit: input.unit ?? source?.unit,
        originName: input.originName ?? origin,
        notes: input.notes ?? source?.notes,
        checked: input.checked ?? false,
        order: show.equipment.filter((entry) => entry.categoryId === categoryId).length,
        includeInInputList: input.includeInInputList !== false,
        assignments: normalizeAssignments(input.assignments, input.quantity ?? 1),
      }
      updateShowInternal(showId, (current) => ({ ...current, equipment: [...current.equipment, item], updatedAt: now() }))
      return id
    },

    updateEquipment: (showId, itemId, patch) =>
      updateShowInternal(showId, (show) => ({
        ...show,
        equipment: show.equipment.map((item) => {
          if (item.id !== itemId) return item
          const quantity = patch.quantity === undefined ? item.quantity : Math.max(0, Math.floor(patch.quantity))
          return normalizeEquipmentItem({
            ...item,
            ...patch,
            id: item.id,
            quantity,
            assignments: normalizeAssignments(patch.assignments ?? item.assignments, quantity),
          })
        }),
        updatedAt: now(),
      })),

    duplicateEquipment: (showId, itemId) =>
      updateShowInternal(showId, (show) => {
        const item = show.equipment.find((entry) => entry.id === itemId)
        if (!item) return show
        const copy = {
          ...clone(item),
          id: uid(),
          name: `${item.name} — copia`,
          checked: false,
          assignments: normalizeAssignments(item.assignments, item.quantity).map((assignment) => ({ ...assignment, id: uid() })),
          order: show.equipment.filter((entry) => entry.categoryId === item.categoryId).length,
        }
        return { ...show, equipment: [...show.equipment, copy], updatedAt: now() }
      }),

    deleteEquipment: (showId, itemId) => {
      const item = get().shows.find((show) => show.id === showId)?.equipment.find((entry) => entry.id === itemId)
      if (item) updateShowInternal(showId, (show) => ({ ...show, equipment: show.equipment.filter((entry) => entry.id !== itemId), updatedAt: now() }))
      return item ? clone(item) : undefined
    },

    restoreEquipment: (showId, item) =>
      updateShowInternal(showId, (show) => ({ ...show, equipment: [...show.equipment.filter((entry) => entry.id !== item.id), item], updatedAt: now() })),

    moveEquipment: (showId, itemId, categoryId, order) =>
      updateShowInternal(showId, (show) => {
        const moved = show.equipment.map((item) => (item.id === itemId ? { ...item, categoryId, order: order ?? Number.MAX_SAFE_INTEGER } : item))
        const normalized = show.equipmentCategories.flatMap((category) =>
          moved
            .filter((item) => item.categoryId === category.id)
            .sort((a, b) => a.order - b.order)
            .map((item, index) => ({ ...item, order: index })),
        )
        return { ...show, equipment: normalized, updatedAt: now() }
      }),

    addPerson: (showId, input, libraryId) => {
      const show = get().shows.find((item) => item.id === showId)
      if (!show) return undefined
      const source = libraryId ? get().library.people.find((item) => item.id === libraryId) : undefined
      const name = (input.name || source?.name || '').trim()
      const exists = show.people.some(
        (person) => (libraryId && person.sourceLibraryId === libraryId) || person.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
      if (!name || exists) return undefined
      const roles = source?.roleIds.map((id) => get().library.roles.find((item) => item.id === id)?.name).filter(Boolean) as string[] | undefined
      const types = source?.typeIds.map((id) => get().library.personTypes.find((item) => item.id === id)?.name).filter(Boolean) as string[] | undefined
      const id = uid()
      const person: ShowPerson = {
        id,
        sourceLibraryId: libraryId,
        name,
        company: input.company ?? source?.company,
        typeNames: input.typeNames ?? types ?? [],
        roleNames: input.roleNames ?? roles ?? [],
        phones: input.phones ?? source?.phones ?? [],
        emails: input.emails ?? source?.emails ?? [],
        notes: input.notes ?? source?.notes,
        order: show.people.length,
      }
      updateShowInternal(showId, (current) => ({ ...current, people: [...current.people, person], updatedAt: now() }))
      return id
    },

    updatePerson: (showId, personId, patch) =>
      updateShowInternal(showId, (show) => ({
        ...show,
        people: show.people.map((person) => (person.id === personId ? { ...person, ...patch, id: person.id } : person)),
        updatedAt: now(),
      })),

    deletePerson: (showId, personId) => {
      const person = get().shows.find((show) => show.id === showId)?.people.find((entry) => entry.id === personId)
      if (person) updateShowInternal(showId, (show) => ({ ...show, people: show.people.filter((entry) => entry.id !== personId), updatedAt: now() }))
      return person ? clone(person) : undefined
    },

    restorePerson: (showId, person) =>
      updateShowInternal(showId, (show) => ({ ...show, people: [...show.people.filter((entry) => entry.id !== person.id), person], updatedAt: now() })),

    addSchedule: (showId, input) => {
      const id = uid()
      updateShowInternal(showId, (show) => ({
        ...show,
        schedule: sortSchedule([
          ...show.schedule,
          { id, name: input.name.trim() || 'Horario', startTime: input.startTime, endTime: input.endTime, notes: input.notes, order: show.schedule.length },
        ]),
        updatedAt: now(),
      }))
      return id
    },

    updateSchedule: (showId, itemId, patch) =>
      updateShowInternal(showId, (show) => ({
        ...show,
        schedule: sortSchedule(show.schedule.map((item) => (item.id === itemId ? { ...item, ...patch, id: item.id } : item))),
        updatedAt: now(),
      })),

    deleteSchedule: (showId, itemId) =>
      updateShowInternal(showId, (show) => ({ ...show, schedule: sortSchedule(show.schedule.filter((item) => item.id !== itemId)), updatedAt: now() })),

    addLibraryItem: (section, input) => {
      const id = uid()
      const createdAt = now()
      const base = { id, name: String(input.name || '').trim() || 'Sin nombre', createdAt, updatedAt: createdAt, archived: false }
      let item: CatalogItem | Category | EquipmentLibraryItem | PersonLibraryItem
      if (section === 'categories') item = { ...base, order: get().library.categories.length }
      else if (section === 'equipment') item = { ...base, categoryId: input.categoryId as string | undefined, unit: input.unit as string | undefined, originId: input.originId as string | undefined, notes: input.notes as string | undefined }
      else if (section === 'people') item = { ...base, company: input.company as string | undefined, typeIds: (input.typeIds as string[]) || [], roleIds: (input.roleIds as string[]) || [], phones: (input.phones as string[]) || [], emails: (input.emails as string[]) || [], notes: input.notes as string | undefined }
      else item = { ...base, notes: input.notes as string | undefined }
      commit((state) => ({ library: { ...state.library, [section]: [...(state.library[section] as any[]), item] } as Library }))
      return id
    },

    updateLibraryItem: (section, id, patch) =>
      commit((state) => ({
        library: {
          ...state.library,
          [section]: (state.library[section] as any[]).map((item) => (item.id === id ? { ...item, ...patch, id: item.id, updatedAt: now() } : item)),
        } as Library,
      })),

    deleteLibraryItem: (section, id) =>
      commit((state) => ({
        library: { ...state.library, [section]: (state.library[section] as any[]).filter((item) => item.id !== id) } as Library,
      })),

    createPresetFromShow: (showId, name) => {
      const show = get().shows.find((item) => item.id === showId)
      if (!show) return undefined
      const id = uid()
      const createdAt = now()
      const preset: Preset = {
        id,
        name: name?.trim() || `${show.name} — preset`,
        description: `Creado desde ${show.name}`,
        archived: false,
        showType: show.showType,
        note: show.note,
        equipmentCategories: clone(show.equipmentCategories),
        equipment: clone(show.equipment).map((item) => ({ ...item, checked: false })),
        people: clone(show.people),
        schedule: clone(show.schedule),
        createdAt,
        updatedAt: createdAt,
      }
      commit((state) => ({ presets: [preset, ...state.presets] }))
      return id
    },

    duplicatePreset: (id) => {
      const source = get().presets.find((item) => item.id === id)
      if (!source) return
      const createdAt = now()
      const copy: Preset = { ...clone(source), id: uid(), name: `${source.name} — copia`, archived: false, createdAt, updatedAt: createdAt }
      commit((state) => ({ presets: [copy, ...state.presets] }))
    },

    updatePreset: (id, patch) =>
      commit((state) => ({ presets: state.presets.map((item) => (item.id === id ? { ...item, ...patch, id: item.id, updatedAt: now() } : item)) })),

    archivePreset: (id, archived) =>
      commit((state) => ({ presets: state.presets.map((item) => (item.id === id ? { ...item, archived, updatedAt: now() } : item)) })),

    deletePreset: (id) => commit((state) => ({ presets: state.presets.filter((item) => item.id !== id) })),

    applyPreset: (showId, presetId, mode) => {
      const preset = get().presets.find((item) => item.id === presetId)
      if (!preset) return
      updateShowInternal(showId, (show) => {
        const mapped = remapPreset(preset)
        if (mode === 'replace') {
          return {
            ...show,
            showType: preset.showType || show.showType,
            note: preset.note || show.note,
            equipmentCategories: mapped.categories,
            equipment: mapped.equipment,
            people: mapped.people,
            schedule: sortSchedule(mapped.schedule),
            updatedAt: now(),
          }
        }
        const categories = clone(show.equipmentCategories)
        const categoryMap = new Map<string, string>()
        for (const sourceCategory of preset.equipmentCategories) {
          let target = categories.find((item) => item.name.toLocaleLowerCase() === sourceCategory.name.toLocaleLowerCase())
          if (!target) {
            target = { id: uid(), name: sourceCategory.name, order: categories.length }
            categories.push(target)
          }
          categoryMap.set(sourceCategory.id, target.id)
        }
        const equipment = [
          ...show.equipment,
          ...preset.equipment.map((item) => ({
            ...clone(item),
            id: uid(),
            categoryId: categoryMap.get(item.categoryId) || categories[0].id,
            checked: false,
            assignments: normalizeAssignments(item.assignments, item.quantity).map((assignment) => ({ ...assignment, id: uid() })),
          })),
        ]
        const people = [...show.people]
        for (const sourcePerson of preset.people) {
          if (!people.some((person) => person.name.toLocaleLowerCase() === sourcePerson.name.toLocaleLowerCase())) people.push({ ...clone(sourcePerson), id: uid(), order: people.length })
        }
        return {
          ...show,
          showType: show.showType || preset.showType,
          note: show.note || preset.note,
          equipmentCategories: categories,
          equipment,
          people,
          schedule: sortSchedule([...show.schedule, ...preset.schedule.map((item) => ({ ...clone(item), id: uid() }))]),
          updatedAt: now(),
        }
      })
    },

    updatePreferences: (patch) => commit((state) => ({ preferences: { ...state.preferences, ...patch } })),

    snapshot: () => makeSnapshot(get()),

    importSnapshot: (snapshot, mode) => {
      if (mode === 'replace') {
        commit(() => ({ shows: clone(snapshot.shows).map(normalizeShow), presets: clone(snapshot.presets).map(normalizePreset), library: clone(snapshot.library), preferences: normalizePreferences(snapshot.preferences) }))
        return
      }
      commit((state) => ({
        shows: mergeById(state.shows, clone(snapshot.shows).map(normalizeShow)),
        presets: mergeById(state.presets, clone(snapshot.presets).map(normalizePreset)),
        library: {
          equipment: mergeById(state.library.equipment, clone(snapshot.library.equipment)),
          people: mergeById(state.library.people, clone(snapshot.library.people)),
          categories: mergeById(state.library.categories, clone(snapshot.library.categories)),
          roles: mergeById(state.library.roles, clone(snapshot.library.roles)),
          personTypes: mergeById(state.library.personTypes, clone(snapshot.library.personTypes)),
          origins: mergeById(state.library.origins, clone(snapshot.library.origins)),
        },
        preferences: normalizePreferences({ ...state.preferences, ...snapshot.preferences }),
      }))
    },

    createBackup: async (reason) => {
      await saveBackup({ id: uid(), createdAt: now(), reason, snapshot: makeSnapshot(get()) })
    },

    applyRemoteShow: (incoming, revision) => serializeRemoteShowApplication(async () => {
      const id = `show:${incoming.id}`
      // Re-check inside the serialized critical section. A local edit can be queued after a
      // Realtime callback's first pending check but before its row reaches the store.
      if (await db.pendingMutations.get(id)) return 'pending'

      const accepted = await db.syncRecords.get(id)
      const decision = classifyRemoteShowRevision(accepted?.revision, revision)
      if (decision !== 'newer') return decision

      const show = normalizeShow(incoming)
      suppressRemoteQueue += 1
      try {
        set((state) => ({ shows: [show, ...state.shows.filter((item) => item.id !== show.id)] }))
        await db.syncRecords.put({ id, revision, syncedAt: now() })
        await writeSnapshot(makeSnapshot(get()))
        return 'applied'
      } finally {
        suppressRemoteQueue -= 1
      }
    }),

    removeRemoteShow: async (showId) => {
      suppressRemoteQueue += 1
      try {
        set((state) => ({ shows: state.shows.filter((item) => item.id !== showId) }))
        await db.syncRecords.delete(`show:${showId}`)
        await writeSnapshot(makeSnapshot(get()))
      } finally {
        suppressRemoteQueue -= 1
      }
    },

    applyRemoteWorkspace: async (workspace, revision) => {
      suppressRemoteQueue += 1
      try {
        set({
          presets: clone(workspace.presets || []).map(normalizePreset),
          library: clone(workspace.library || seedLibrary),
          preferences: normalizePreferences(workspace.preferences),
        })
        await db.syncRecords.put({ id: 'workspace', revision, syncedAt: now() })
        await writeSnapshot(makeSnapshot(get()))
      } finally {
        suppressRemoteQueue -= 1
      }
    },
  }
})
