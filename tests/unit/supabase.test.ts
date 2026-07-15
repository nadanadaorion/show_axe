import { describe, expect, it } from 'vitest'
import { remoteRowToShow } from '../../src/lib/supabase'

describe('remoteRowToShow', () => {
  it('maps a remote row into a Show, normalizing equipment assignments from quantity', () => {
    const row = {
      id: 'show-1',
      public_slug: 'slug-1',
      data: {
        name: 'Test Show',
        equipment: [{ id: 'eq-1', categoryId: 'cat-1', name: 'SM58', quantity: 2, checked: false, order: 0 }],
      },
      archived: false,
      revision: 3,
      updated_at: '2026-02-01T00:00:00.000Z',
    }

    const show = remoteRowToShow(row)

    expect(show.id).toBe('show-1')
    expect(show.publicSlug).toBe('slug-1')
    expect(show.name).toBe('Test Show')
    expect(show.updatedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(show.equipment[0].assignments).toHaveLength(2)
  })

  it('falls back to a placeholder name when data.name is missing or not a string', () => {
    const row = { id: 'x', public_slug: 's', data: {}, archived: false, revision: 1, updated_at: '2026-01-01T00:00:00.000Z' }
    expect(remoteRowToShow(row).name).toBe('Show sin nombre')
  })

  it('defaults missing collections to empty arrays rather than undefined', () => {
    const row = { id: 'x', public_slug: 's', data: { name: 'Bare' }, archived: false, revision: 1, updated_at: '2026-01-01T00:00:00.000Z' }
    const show = remoteRowToShow(row)
    expect(show.equipmentCategories).toEqual([])
    expect(show.equipment).toEqual([])
    expect(show.people).toEqual([])
    expect(show.schedule).toEqual([])
  })

  it('carries the archived flag from the row column, not the embedded data', () => {
    const row = { id: 'x', public_slug: 's', data: { name: 'A', archived: false }, archived: true, revision: 1, updated_at: '2026-01-01T00:00:00.000Z' }
    expect(remoteRowToShow(row).archived).toBe(true)
  })
})
