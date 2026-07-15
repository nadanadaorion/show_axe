import { describe, expect, it } from 'vitest'
import { formatDate, formatTime, isAppSnapshot, scheduleDuration, validateAppSnapshot } from '../../src/lib/utils'
import { buildLibrary, buildPreferences } from '../fixtures/builders'

describe('scheduleDuration', () => {
  it('computes duration from an explicit end time', () => {
    expect(scheduleDuration({ id: '1', name: 'Soundcheck', startTime: '18:00', endTime: '18:45', order: 0 })).toBe(
      '45 min',
    )
  })

  it('computes duration in hours and minutes', () => {
    expect(scheduleDuration({ id: '1', name: 'Doors', startTime: '18:00', endTime: '20:30', order: 0 })).toBe(
      '2 h 30 min',
    )
  })

  it('falls back to the next item start time when end time is missing', () => {
    const item = { id: '1', name: 'Doors', startTime: '18:00', order: 0 }
    const next = { id: '2', name: 'Set start', startTime: '19:00', order: 1 }
    expect(scheduleDuration(item, next)).toBe('1 h')
  })

  it('returns an empty string when there is no end reference', () => {
    expect(scheduleDuration({ id: '1', name: 'Doors', startTime: '18:00', order: 0 })).toBe('')
  })

  it('wraps past midnight instead of going negative', () => {
    expect(scheduleDuration({ id: '1', name: 'Set', startTime: '23:30', endTime: '00:15', order: 0 })).toBe(
      '45 min',
    )
  })
})

describe('formatDate', () => {
  it('formats an ISO date as dd/MM/yyyy', () => {
    expect(formatDate('2026-07-15', 'dd/MM/yyyy')).toBe('15/07/2026')
  })

  it('formats an ISO date as MM/dd/yyyy', () => {
    expect(formatDate('2026-07-15', 'MM/dd/yyyy')).toBe('07/15/2026')
  })

  it('returns a placeholder when there is no date', () => {
    expect(formatDate(undefined, 'dd/MM/yyyy')).toBe('Sin fecha')
  })
})

describe('formatTime', () => {
  it('passes through 24h format unchanged', () => {
    expect(formatTime('14:05', '24h')).toBe('14:05')
  })

  it('converts to 12h format with AM/PM', () => {
    expect(formatTime('14:05', '12h')).toBe('2:05 PM')
  })

  it('returns a placeholder when there is no time', () => {
    expect(formatTime(undefined, '24h')).toBe('Sin hora')
  })
})

describe('isAppSnapshot', () => {
  it('accepts a well-shaped snapshot', () => {
    const snapshot = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      shows: [],
      presets: [],
      library: buildLibrary(),
      preferences: buildPreferences(),
    }
    expect(isAppSnapshot(snapshot)).toBe(true)
  })

  it('rejects an unsupported version', () => {
    const snapshot = { version: 99, shows: [], presets: [], library: {}, preferences: {} }
    expect(isAppSnapshot(snapshot)).toBe(false)
    expect(validateAppSnapshot(snapshot)).toEqual({ valid: false, error: 'La versión del respaldo no es compatible con Ori♡n Shows V2.' })
  })

  it('rejects malformed nested Show data instead of allowing an import-time crash', () => {
    const snapshot = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      shows: [{ id: 'broken', name: 'Broken', archived: false, equipmentCategories: [], equipment: 'not-an-array', people: [], schedule: [] }],
      presets: [],
      library: buildLibrary(),
      preferences: buildPreferences(),
    }
    expect(isAppSnapshot(snapshot)).toBe(false)
  })

  it('rejects an incomplete Library before mutating current data', () => {
    const snapshot = { version: 3, exportedAt: '2026-01-01T00:00:00.000Z', shows: [], presets: [], library: { equipment: [] }, preferences: {} }
    expect(validateAppSnapshot(snapshot)).toMatchObject({ valid: false, error: expect.stringContaining('Biblioteca') })
  })

  it('rejects malformed nested Library people and incompatible preferences', () => {
    const base = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      shows: [],
      presets: [],
      library: buildLibrary(),
      preferences: buildPreferences(),
    }
    expect(validateAppSnapshot({
      ...base,
      library: { ...base.library, people: [{ id: 'person-1', name: 'Incomplete' }] },
    })).toMatchObject({ valid: false, error: expect.stringContaining('Biblioteca') })
    expect(validateAppSnapshot({
      ...base,
      preferences: { ...base.preferences, initialModule: 'inventory' },
    })).toMatchObject({ valid: false, error: expect.stringContaining('Preferencias') })
  })

  it('rejects a payload missing required arrays', () => {
    expect(isAppSnapshot({ version: 1, library: {}, preferences: {} })).toBe(false)
  })

  it('rejects non-object input', () => {
    expect(isAppSnapshot(null)).toBe(false)
    expect(isAppSnapshot('not a snapshot')).toBe(false)
  })
})
