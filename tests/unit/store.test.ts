import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSnapshot, InputListConfig, Show } from '../../src/types'

/**
 * The store persists to Dexie (debounced) and queues remote sync mutations
 * as a side effect of every state change. Both are mocked so these tests
 * exercise only the store's business-rule logic (state transitions), per
 * the "Unit tests: pure domain logic" layer in docs/19-TESTING_STRATEGY.md,
 * without depending on real/fake IndexedDB or network state.
 */
vi.mock('../../src/lib/db', () => {
  const backups = {
    put: vi.fn().mockResolvedValue(undefined),
    orderBy: () => ({ reverse: () => ({ toArray: vi.fn().mockResolvedValue([]) }) }),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
  }
  return {
    db: {
      shows: { toArray: vi.fn().mockResolvedValue([]) },
      presets: { toArray: vi.fn().mockResolvedValue([]) },
      equipmentLibrary: { toArray: vi.fn().mockResolvedValue([]) },
      peopleLibrary: { toArray: vi.fn().mockResolvedValue([]) },
      categories: { toArray: vi.fn().mockResolvedValue([]) },
      roles: { toArray: vi.fn().mockResolvedValue([]) },
      personTypes: { toArray: vi.fn().mockResolvedValue([]) },
      origins: { toArray: vi.fn().mockResolvedValue([]) },
      preferences: { get: vi.fn().mockResolvedValue(undefined) },
      backups,
      syncRecords: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      pendingMutations: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) },
    },
    writeLocalSnapshot: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../src/lib/syncQueue', () => ({
  queueShowUpsert: vi.fn().mockResolvedValue(undefined),
  queueShowDelete: vi.fn().mockResolvedValue(undefined),
  queueWorkspaceUpsert: vi.fn().mockResolvedValue(undefined),
}))

const { useAppStore } = await import('../../src/store')
const { queueShowDelete, queueShowUpsert } = await import('../../src/lib/syncQueue')

const BASE_CATEGORY = { id: 'cat-main', name: 'Audio', order: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
const BASE_PREFERENCES = {
  dateFormat: 'dd/MM/yyyy' as const,
  timeFormat: '24h' as const,
  language: 'es' as const,
  initialModule: 'shows' as const,
  theme: 'system' as const,
  showInputListWarnings: true,
}

function resetStore() {
  useAppStore.setState({
    ready: false,
    shows: [],
    presets: [],
    library: { equipment: [], people: [], categories: [BASE_CATEGORY], roles: [], personTypes: [], origins: [] },
    preferences: { ...BASE_PREFERENCES },
  })
  vi.clearAllMocks()
}

function getShow(id: string): Show {
  const show = useAppStore.getState().shows.find((item) => item.id === id)
  if (!show) throw new Error(`Show ${id} not found`)
  return show
}

beforeEach(resetStore)

describe('Library edits do not mutate existing Shows (snapshot isolation)', () => {
  it('preserves the copied equipment values after the Library source is renamed', () => {
    const libraryId = useAppStore.getState().addLibraryItem('equipment', { name: 'SM58', unit: 'pz' })
    const showId = useAppStore.getState().createShow({ name: 'Concierto' })
    // Empty name so addEquipment falls back to the Library source's name/unit (a "copy from Library" add).
    useAppStore.getState().addEquipment(showId, { name: '' }, libraryId)

    const before = getShow(showId).equipment[0]
    expect(before.name).toBe('SM58')
    expect(before.unit).toBe('pz')

    useAppStore.getState().updateLibraryItem('equipment', libraryId, { name: 'SM58 RENAMED', unit: 'kg' })

    const after = getShow(showId).equipment[0]
    expect(after.name).toBe('SM58')
    expect(after.unit).toBe('pz')
  })

  it('preserves Show equipment after the Library source is deleted', () => {
    const libraryId = useAppStore.getState().addLibraryItem('equipment', { name: 'DI Box' })
    const showId = useAppStore.getState().createShow({ name: 'Concierto' })
    useAppStore.getState().addEquipment(showId, { name: '' }, libraryId)

    useAppStore.getState().deleteLibraryItem('equipment', libraryId)

    expect(getShow(showId).equipment).toHaveLength(1)
    expect(getShow(showId).equipment[0].name).toBe('DI Box')
  })

  it('preserves the copied person after the Library source is renamed and deleted', () => {
    const libraryId = useAppStore.getState().addLibraryItem('people', { name: 'Alex Rivera', company: 'Acme' })
    const showId = useAppStore.getState().createShow({ name: 'Concierto' })
    useAppStore.getState().addPerson(showId, { name: '' }, libraryId)

    useAppStore.getState().updateLibraryItem('people', libraryId, { name: 'RENAMED', company: 'Other' })
    expect(getShow(showId).people[0].name).toBe('Alex Rivera')
    expect(getShow(showId).people[0].company).toBe('Acme')

    useAppStore.getState().deleteLibraryItem('people', libraryId)
    expect(getShow(showId).people).toHaveLength(1)
    expect(getShow(showId).people[0].name).toBe('Alex Rivera')
  })
})

describe('Preset edits do not mutate Shows already created from that Preset', () => {
  it('leaves a Show untouched after its source Preset is edited and deleted', () => {
    const sourceShowId = useAppStore.getState().createShow({ name: 'Plantilla' })
    useAppStore.getState().addEquipment(sourceShowId, { name: 'SM58', quantity: 1 })
    const presetId = useAppStore.getState().createPresetFromShow(sourceShowId, 'Banda estándar')!

    const derivedShowId = useAppStore.getState().createShow({ name: 'Show desde preset' }, presetId)
    const derivedEquipmentBefore = getShow(derivedShowId).equipment.map((item) => item.name)

    useAppStore.getState().updatePreset(presetId, { name: 'RENAMED' })
    useAppStore.getState().deletePreset(presetId)

    expect(getShow(derivedShowId).equipment.map((item) => item.name)).toEqual(derivedEquipmentBefore)
    expect(getShow(derivedShowId).equipment).toHaveLength(1)
  })
})

describe('Equipment quantity changes keep assignments consistent', () => {
  it('preserves the earliest assignments when quantity is reduced, and adds blanks when increased', () => {
    const showId = useAppStore.getState().createShow({ name: 'Concierto' })
    const itemId = useAppStore.getState().addEquipment(showId, { name: 'SM58', quantity: 3 })!

    const initial = getShow(showId).equipment[0].assignments!
    expect(initial).toHaveLength(3)
    useAppStore.getState().updateEquipment(showId, itemId, {
      assignments: [
        { id: initial[0].id, use: 'Kick in' },
        { id: initial[1].id, use: 'Snare' },
        { id: initial[2].id, use: 'Hat' },
      ],
    })

    useAppStore.getState().updateEquipment(showId, itemId, { quantity: 1 })
    const reduced = getShow(showId).equipment[0]
    expect(reduced.quantity).toBe(1)
    expect(reduced.assignments).toHaveLength(1)
    expect(reduced.assignments![0]).toEqual({ id: initial[0].id, use: 'Kick in' })

    useAppStore.getState().updateEquipment(showId, itemId, { quantity: 3 })
    const increased = getShow(showId).equipment[0]
    expect(increased.assignments).toHaveLength(3)
    expect(increased.assignments![0]).toEqual({ id: initial[0].id, use: 'Kick in' })
    expect(increased.assignments![1].use).toBe('')
    expect(increased.assignments![2].use).toBe('')
  })
})

describe('Duplicate Show remaps internal IDs correctly', () => {
  function buildSourceShow() {
    const showId = useAppStore.getState().createShow({ name: 'Original' })
    const equipmentId = useAppStore.getState().addEquipment(showId, { name: 'SM58', quantity: 2 })!
    const source = getShow(showId)
    const [assignment1, assignment2] = source.equipment[0].assignments!
    useAppStore.getState().updateEquipment(showId, equipmentId, {
      assignments: [
        { id: assignment1.id, use: 'Lead vocal' },
        { id: assignment2.id, use: 'Backing vocal' },
      ],
    })
    useAppStore.getState().addPerson(showId, { name: 'Alex Rivera' })
    useAppStore.getState().addSchedule(showId, { name: 'Soundcheck', startTime: '18:00' })

    const inputList: InputListConfig = {
      rows: [
        {
          id: 'row-generated',
          order: 0,
          channel: '1',
          use: 'Lead vocal',
          equipment: 'SM58',
          phantom: false,
          sourceEquipmentId: equipmentId,
          sourceAssignmentId: assignment1.id,
          sourceEquipmentName: 'SM58',
          sourceUse: 'Lead vocal',
        },
        { id: 'row-manual', order: 1, channel: '99', use: 'Playback L', equipment: 'DI', phantom: false },
      ],
      channelStart: 1,
      returns: [{ id: 'return-1', order: 0, destination: 'Drums', system: 'IEM', stereo: true, outputStart: 1 }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    useAppStore.getState().updateShow(showId, { inputList })
    useAppStore.getState().archiveShow(showId, true)
    return showId
  }

  it('gives the copy new ids everywhere, remaps Input List provenance, and clears archived state', () => {
    const originalId = buildSourceShow()
    const original = getShow(originalId)

    const copyId = useAppStore.getState().duplicateShow(originalId)!
    const copy = getShow(copyId)

    expect(copyId).not.toBe(originalId)
    expect(copy.publicSlug).not.toBe(original.publicSlug)
    expect(copy.archived).toBe(false)
    expect(copy.name).toContain('copia')

    // Original Show is untouched.
    expect(getShow(originalId)).toEqual(original)

    // Categories get new, non-overlapping ids.
    const originalCategoryIds = new Set(original.equipmentCategories.map((c) => c.id))
    for (const category of copy.equipmentCategories) expect(originalCategoryIds.has(category.id)).toBe(false)

    // Equipment gets a new id, still points at a category that exists on the copy.
    expect(copy.equipment).toHaveLength(1)
    const copyEquipment = copy.equipment[0]
    expect(copyEquipment.id).not.toBe(original.equipment[0].id)
    expect(copy.equipmentCategories.map((c) => c.id)).toContain(copyEquipment.categoryId)

    // Assignments get new ids but keep their `use` values, in order.
    const originalAssignmentIds = new Set(original.equipment[0].assignments!.map((a) => a.id))
    const copyAssignments = copyEquipment.assignments!
    expect(copyAssignments.map((a) => a.use)).toEqual(['Lead vocal', 'Backing vocal'])
    for (const assignment of copyAssignments) expect(originalAssignmentIds.has(assignment.id)).toBe(false)

    // People and schedule get new ids, same content.
    expect(copy.people[0].id).not.toBe(original.people[0].id)
    expect(copy.people[0].name).toBe('Alex Rivera')
    expect(copy.schedule[0].id).not.toBe(original.schedule[0].id)
    expect(copy.schedule[0].name).toBe('Soundcheck')

    // Generated Input List row: provenance is remapped to the copy's new equipment/assignment ids.
    const copyGeneratedRow = copy.inputList!.rows.find((row) => row.channel === '1')!
    expect(copyGeneratedRow.id).not.toBe('row-generated')
    expect(copyGeneratedRow.sourceEquipmentId).toBe(copyEquipment.id)
    expect(copyGeneratedRow.sourceAssignmentId).toBe(copyAssignments[0].id)
    expect(copyGeneratedRow.use).toBe('Lead vocal')

    // Manual Input List row: new id, content untouched, no provenance to remap.
    const copyManualRow = copy.inputList!.rows.find((row) => row.channel === '99')!
    expect(copyManualRow.id).not.toBe('row-manual')
    expect(copyManualRow.sourceEquipmentId).toBeUndefined()
    expect(copyManualRow.use).toBe('Playback L')

    // Monitor return: new id, same content.
    expect(copy.inputList!.returns[0].id).not.toBe('return-1')
    expect(copy.inputList!.returns[0]).toMatchObject({ destination: 'Drums', system: 'IEM', stereo: true, outputStart: 1 })
  })
})

describe('Archive preserves public slug; delete removes the local Show and queues remote deletion', () => {
  it('keeps the public slug and content across archive/restore', () => {
    const showId = useAppStore.getState().createShow({ name: 'Concierto' })
    const slug = getShow(showId).publicSlug

    useAppStore.getState().archiveShow(showId, true)
    expect(getShow(showId).archived).toBe(true)
    expect(getShow(showId).publicSlug).toBe(slug)

    useAppStore.getState().archiveShow(showId, false)
    expect(getShow(showId).archived).toBe(false)
    expect(getShow(showId).publicSlug).toBe(slug)
  })

  it('removes the Show locally and queues a show-delete mutation, not a fresh upsert', () => {
    const showId = useAppStore.getState().createShow({ name: 'Concierto' })
    vi.clearAllMocks()

    const deleted = useAppStore.getState().deleteShow(showId)

    expect(deleted?.id).toBe(showId)
    expect(useAppStore.getState().shows.find((show) => show.id === showId)).toBeUndefined()
    expect(queueShowDelete).toHaveBeenCalledWith(showId)
    expect(queueShowUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ id: showId }))
  })
})

describe('JSON import: merge and replace behavior', () => {
  function makeSnapshotFixture(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
    return {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      shows: [],
      presets: [],
      library: { equipment: [], people: [], categories: [], roles: [], personTypes: [], origins: [] },
      preferences: { ...BASE_PREFERENCES },
      ...overrides,
    }
  }

  it('merge keeps existing non-colliding data and lets incoming data win on id collisions', () => {
    const keptId = useAppStore.getState().createShow({ name: 'Local only' })
    const collidingId = useAppStore.getState().createShow({ name: 'Local version' })

    const incomingShow: Show = { ...getShow(collidingId), name: 'Imported version', updatedAt: '2026-02-01T00:00:00.000Z' }
    const newShow: Show = { ...getShow(keptId), id: 'imported-show', publicSlug: 'imported-slug', name: 'Brand new' }

    useAppStore.getState().importSnapshot(makeSnapshotFixture({ shows: [incomingShow, newShow] }), 'merge')

    const state = useAppStore.getState()
    expect(state.shows).toHaveLength(3)
    expect(state.shows.find((s) => s.id === keptId)?.name).toBe('Local only')
    expect(state.shows.find((s) => s.id === collidingId)?.name).toBe('Imported version')
    expect(state.shows.find((s) => s.id === 'imported-show')?.name).toBe('Brand new')
  })

  it('replace discards local data not present in the imported snapshot', () => {
    useAppStore.getState().createShow({ name: 'Will be discarded' })
    const importedShow: Show = { ...getShow(useAppStore.getState().shows[0].id), id: 'replacement-show', name: 'Replacement' }

    useAppStore.getState().importSnapshot(makeSnapshotFixture({ shows: [importedShow] }), 'replace')

    const state = useAppStore.getState()
    expect(state.shows).toHaveLength(1)
    expect(state.shows[0].id).toBe('replacement-show')
    expect(state.shows[0].name).toBe('Replacement')
  })
})
