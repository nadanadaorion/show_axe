// Must run before importing src/lib/db.ts, which opens Dexie at module load time.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/lib/db'
import { classifyRemoteShowRevision } from '../../src/lib/showRevision'
import { acknowledgeShowMutation, queueShowUpsert } from '../../src/lib/syncQueue'
import { useAppStore } from '../../src/store'
import type { Show } from '../../src/types'
import {
  buildEquipmentCategory,
  buildEquipmentItem,
  buildInputList,
  buildInputListRow,
  buildPerson,
  buildEmptyShow,
} from '../fixtures/builders'

const timestamp = '2026-01-01T00:00:00.000Z'

function showAtRevision(name: string, equipmentName: string): Show {
  const category = buildEquipmentCategory({ id: 'category-audio', name: 'Audio' })
  const equipment = buildEquipmentItem({
    id: 'equipment-main',
    categoryId: category.id,
    name: equipmentName,
    quantity: 1,
    assignments: [{ id: 'assignment-main', use: 'Lead vocal' }],
  })
  return buildEmptyShow({
    id: 'show-monotonic',
    publicSlug: 'show-monotonic-slug',
    name,
    note: `${name} information`,
    equipmentCategories: [category],
    equipment: [equipment],
    people: [buildPerson({ id: 'person-main', name: `${name} person` })],
    schedule: [{ id: 'schedule-main', name: `${name} schedule`, startTime: '18:00', order: 0 }],
    inputList: buildInputList({
      rows: [buildInputListRow({ id: 'row-main', equipment: equipmentName, use: 'Lead vocal' })],
      generalNotes: `${name} input notes`,
    }),
    updatedAt: timestamp,
  })
}

async function resetState(show = showAtRevision('Accepted revision 2', 'Protected console'), revision = 2) {
  await Promise.all(db.tables.map((table) => table.clear()))
  localStorage.clear()
  useAppStore.setState({ shows: [show] })
  await db.syncRecords.put({ id: `show:${show.id}`, revision, syncedAt: timestamp })
  vi.restoreAllMocks()
}

describe('monotonic remote Show revision application', () => {
  beforeEach(() => resetState())

  it('classifies lower, equal, and higher revisions without using timestamps', () => {
    expect(classifyRemoteShowRevision(2, 1)).toBe('stale')
    expect(classifyRemoteShowRevision(2, 2)).toBe('duplicate')
    expect(classifyRemoteShowRevision(2, 3)).toBe('newer')
  })

  it('ignores revision 1 after revision 2 without writing Zustand or IndexedDB', async () => {
    const before = useAppStore.getState().shows[0]
    const stale = buildEmptyShow({
      id: before.id,
      publicSlug: before.publicSlug,
      name: 'Stale empty payload',
      equipment: [],
      people: [],
      schedule: [],
      inputList: undefined,
    })
    const recordPut = vi.spyOn(db.syncRecords, 'put')
    const showWrite = vi.spyOn(db.shows, 'bulkPut')

    await expect(useAppStore.getState().applyRemoteShow(stale, 1)).resolves.toBe('stale')

    expect(useAppStore.getState().shows[0]).toBe(before)
    expect(useAppStore.getState().shows[0]).toMatchObject({
      equipment: before.equipment,
      people: before.people,
      schedule: before.schedule,
      inputList: before.inputList,
      note: before.note,
    })
    expect(recordPut).not.toHaveBeenCalled()
    expect(showWrite).not.toHaveBeenCalled()
  })

  it('treats an equal revision as an idempotent duplicate with no writes', async () => {
    const before = useAppStore.getState().shows[0]
    const recordPut = vi.spyOn(db.syncRecords, 'put')
    const showWrite = vi.spyOn(db.shows, 'bulkPut')

    await expect(useAppStore.getState().applyRemoteShow(showAtRevision('Duplicate payload', 'Duplicate equipment'), 2)).resolves.toBe('duplicate')

    expect(useAppStore.getState().shows[0]).toBe(before)
    expect(recordPut).not.toHaveBeenCalled()
    expect(showWrite).not.toHaveBeenCalled()
  })

  it('applies a higher revision to Zustand and IndexedDB', async () => {
    const newer = showAtRevision('Accepted revision 3', 'Revision 3 console')

    await expect(useAppStore.getState().applyRemoteShow(newer, 3)).resolves.toBe('applied')

    expect(useAppStore.getState().shows[0].name).toBe('Accepted revision 3')
    expect(useAppStore.getState().shows[0].equipment[0].name).toBe('Revision 3 console')
    expect((await db.syncRecords.get(`show:${newer.id}`))?.revision).toBe(3)
    expect((await db.shows.get(newer.id))?.equipment[0].name).toBe('Revision 3 console')
  })

  it('does not let an old INSERT revert a successful save response', async () => {
    await resetState(showAtRevision('Revision 1', 'Initial equipment'), 1)
    const saved = showAtRevision('Saved revision 2', 'Saved console')
    const oldInsert = buildEmptyShow({ id: saved.id, publicSlug: saved.publicSlug, name: 'Old INSERT', equipment: [] })

    await expect(useAppStore.getState().applyRemoteShow(saved, 2)).resolves.toBe('applied')
    await expect(useAppStore.getState().applyRemoteShow(oldInsert, 1)).resolves.toBe('stale')

    expect(useAppStore.getState().shows[0].equipment[0].name).toBe('Saved console')
    expect((await db.syncRecords.get(`show:${saved.id}`))?.revision).toBe(2)
  })

  it('preserves an edit coalesced while creation is in flight and rebases its next save', async () => {
    const creating = buildEmptyShow({
      id: 'show-in-flight',
      publicSlug: 'show-in-flight-slug',
      name: 'Creating',
      updatedAt: timestamp,
    })
    await resetState(creating, 0)
    await queueShowUpsert(creating)
    const inFlight = await db.pendingMutations.get('show:show-in-flight')

    const edited = showAtRevision('Edited while creating', 'Torre de bajos')
    edited.id = creating.id
    edited.publicSlug = creating.publicSlug
    useAppStore.setState({ shows: [edited] })
    await queueShowUpsert(edited)

    await expect(acknowledgeShowMutation(inFlight!, 1)).resolves.toBe('rebased')
    await expect(useAppStore.getState().applyRemoteShow(creating, 1)).resolves.toBe('pending')

    expect(useAppStore.getState().shows[0].equipment[0].name).toBe('Torre de bajos')
    expect((await db.pendingMutations.get('show:show-in-flight'))?.expectedRevision).toBe(1)
    expect((await db.syncRecords.get('show:show-in-flight'))?.revision).toBe(1)
  })

  it('serializes out-of-order revision 3 then revision 2 and remains at revision 3', async () => {
    await resetState(showAtRevision('Revision 1', 'Initial equipment'), 1)
    const revision3 = showAtRevision('Revision 3', 'Newest console')
    const revision2 = showAtRevision('Revision 2', 'Older console')

    const results = await Promise.all([
      useAppStore.getState().applyRemoteShow(revision3, 3),
      useAppStore.getState().applyRemoteShow(revision2, 2),
    ])

    expect(results).toEqual(['applied', 'stale'])
    expect(useAppStore.getState().shows[0].equipment[0].name).toBe('Newest console')
    expect((await db.syncRecords.get(`show:${revision3.id}`))?.revision).toBe(3)
  })

  it('keeps a higher remote row out of Zustand while a local mutation is pending', async () => {
    const before = useAppStore.getState().shows[0]
    await db.pendingMutations.put({
      id: `show:${before.id}`,
      kind: 'show-upsert',
      entityId: before.id,
      expectedRevision: 2,
      queuedAt: timestamp,
      show: { ...before, name: 'Pending local edit' },
    })

    await expect(useAppStore.getState().applyRemoteShow(showAtRevision('Remote revision 3', 'Remote console'), 3)).resolves.toBe('pending')

    expect(useAppStore.getState().shows[0]).toBe(before)
    expect((await db.syncRecords.get(`show:${before.id}`))?.revision).toBe(2)
    expect(await db.pendingMutations.get(`show:${before.id}`)).toBeDefined()
  })

  it('makes the same-device Realtime echo idempotent after the save was accepted', async () => {
    const saved = showAtRevision('Saved revision 3', 'Echo-safe console')
    await useAppStore.getState().applyRemoteShow(saved, 3)
    const recordPut = vi.spyOn(db.syncRecords, 'put')
    const showWrite = vi.spyOn(db.shows, 'bulkPut')

    await expect(useAppStore.getState().applyRemoteShow(saved, 3)).resolves.toBe('duplicate')

    expect(recordPut).not.toHaveBeenCalled()
    expect(showWrite).not.toHaveBeenCalled()
    expect(useAppStore.getState().shows[0].equipment[0].name).toBe('Echo-safe console')
  })
})
