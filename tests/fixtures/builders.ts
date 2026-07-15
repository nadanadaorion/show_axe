import type {
  EquipmentAssignment,
  InputListConfig,
  InputListRow,
  Library,
  MonitorReturn,
  Preferences,
  Preset,
  Show,
  ShowConflict,
  ShowEquipmentCategory,
  ShowEquipmentItem,
  ShowPerson,
  WorkspaceData,
} from '../../src/types'

/**
 * Deterministic id/time sequence so fixture output (and test assertions) never
 * depends on `crypto.randomUUID()` or wall-clock time.
 */
let sequence = 0
export function resetFixtureSequence() {
  sequence = 0
}
export function fixtureId(prefix = 'id') {
  sequence += 1
  return `${prefix}-${sequence}`
}
export const FIXTURE_TIMESTAMP = '2026-01-01T00:00:00.000Z'

export function buildEquipmentCategory(overrides: Partial<ShowEquipmentCategory> = {}): ShowEquipmentCategory {
  return {
    id: fixtureId('category'),
    name: 'Microphones',
    order: 0,
    ...overrides,
  }
}

export function buildAssignment(overrides: Partial<EquipmentAssignment> = {}): EquipmentAssignment {
  return {
    id: fixtureId('assignment'),
    use: '',
    ...overrides,
  }
}

export function buildEquipmentItem(overrides: Partial<ShowEquipmentItem> = {}): ShowEquipmentItem {
  const quantity = overrides.quantity ?? 2
  return {
    id: fixtureId('equipment'),
    categoryId: fixtureId('category'),
    name: 'SM58',
    quantity,
    checked: false,
    order: 0,
    includeInInputList: true,
    assignments: Array.from({ length: quantity }, () => buildAssignment()),
    ...overrides,
  }
}

export function buildPerson(overrides: Partial<ShowPerson> = {}): ShowPerson {
  return {
    id: fixtureId('person'),
    name: 'Alex Rivera',
    typeNames: [],
    roleNames: [],
    phones: [],
    emails: [],
    order: 0,
    ...overrides,
  }
}

export function buildInputListRow(overrides: Partial<InputListRow> = {}): InputListRow {
  return {
    id: fixtureId('row'),
    order: 0,
    channel: '1',
    use: '',
    equipment: '',
    phantom: false,
    ...overrides,
  }
}

export function buildMonitorReturn(overrides: Partial<MonitorReturn> = {}): MonitorReturn {
  return {
    id: fixtureId('return'),
    order: 0,
    destination: 'Drums',
    system: 'IEM',
    stereo: false,
    outputStart: 1,
    ...overrides,
  }
}

export function buildInputList(overrides: Partial<InputListConfig> = {}): InputListConfig {
  return {
    rows: [],
    channelStart: 1,
    returns: [],
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  }
}

/** Input List whose rows start numbering at 17, per the documented custom-channel fixture. */
export function buildInputListStartingAt17(overrides: Partial<InputListConfig> = {}): InputListConfig {
  return buildInputList({
    channelStart: 17,
    rows: [
      buildInputListRow({ channel: '17', use: 'Kick in' }),
      buildInputListRow({ channel: '18', order: 1, use: 'Kick out' }),
    ],
    ...overrides,
  })
}

/** Input List mixing a generated (equipment-sourced) row with a hand-added manual row. */
export function buildMixedInputList(overrides: Partial<InputListConfig> = {}): InputListConfig {
  const sourceEquipmentId = fixtureId('equipment')
  const sourceAssignmentId = fixtureId('assignment')
  return buildInputList({
    rows: [
      buildInputListRow({
        channel: '1',
        use: 'Vocal',
        equipment: 'SM58',
        sourceEquipmentId,
        sourceAssignmentId,
        sourceEquipmentName: 'SM58',
        sourceUse: 'Vocal',
      }),
      buildInputListRow({ channel: '2', order: 1, use: 'Playback L', equipment: 'DI' }),
    ],
    ...overrides,
  })
}

/** Empty Show: only a name, matching the "create with name only" business rule. */
export function buildEmptyShow(overrides: Partial<Show> = {}): Show {
  return {
    id: fixtureId('show'),
    publicSlug: fixtureId('slug'),
    name: 'Untitled Show',
    archived: false,
    equipmentCategories: [],
    equipment: [],
    people: [],
    schedule: [],
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  }
}

/** Show with a grouped microphone line and per-unit assignments, as used across Equipment/Input List rules. */
export function buildShowWithMicrophones(overrides: Partial<Show> = {}): Show {
  const category = buildEquipmentCategory({ name: 'Microphones', order: 0 })
  const equipment = buildEquipmentItem({
    categoryId: category.id,
    name: 'SM58',
    quantity: 2,
    assignments: [buildAssignment({ use: 'Lead vocal' }), buildAssignment({ use: 'Backing vocal' })],
  })
  return buildEmptyShow({
    name: 'Grouped Microphones Show',
    equipmentCategories: [category],
    equipment: [equipment],
    ...overrides,
  })
}

export function buildLibrary(overrides: Partial<Library> = {}): Library {
  return {
    equipment: [],
    people: [],
    categories: [],
    roles: [],
    personTypes: [],
    origins: [],
    ...overrides,
  }
}

export function buildPreset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: fixtureId('preset'),
    name: 'Standard Band',
    archived: false,
    equipmentCategories: [],
    equipment: [],
    people: [],
    schedule: [],
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  }
}

export function buildPreferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: '24h',
    language: 'es',
    initialModule: 'shows',
    theme: 'system',
    showInputListWarnings: true,
    ...overrides,
  }
}

export function buildWorkspace(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    presets: [buildPreset()],
    library: buildLibrary(),
    preferences: buildPreferences(),
    ...overrides,
  }
}

/** Conflict caused by a stale expected revision: remote has moved on since the local pending mutation was queued. */
export function buildRevisionConflict(overrides: Partial<ShowConflict> = {}): ShowConflict {
  const showId = fixtureId('show')
  return {
    id: fixtureId('conflict'),
    showId,
    operation: 'upsert',
    localShow: buildEmptyShow({ id: showId, name: 'Local edit' }),
    remoteShow: buildEmptyShow({ id: showId, name: 'Remote edit' }),
    remoteRevision: 4,
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  }
}

/** Conflict caused by the remote Show having been deleted after the local client last synchronized. */
export function buildDeletedRemoteConflict(overrides: Partial<ShowConflict> = {}): ShowConflict {
  const showId = fixtureId('show')
  return {
    id: fixtureId('conflict'),
    showId,
    operation: 'upsert',
    localShow: buildEmptyShow({ id: showId, name: 'Local edit' }),
    remoteShow: undefined,
    remoteRevision: 0,
    remoteDeleted: true,
    createdAt: FIXTURE_TIMESTAMP,
    ...overrides,
  }
}
