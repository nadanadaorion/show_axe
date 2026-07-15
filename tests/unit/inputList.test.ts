import { beforeEach, describe, expect, it } from 'vitest'
import {
  generatedRowsFromEquipment,
  nextInputChannel,
  nextReturnOutput,
  normalizeAssignments,
  outputLabel,
  previewInputListSync,
  renumberInputRows,
} from '../../src/lib/inputList'
import {
  buildEquipmentItem,
  buildInputListRow,
  buildInputListStartingAt17,
  buildMixedInputList,
  buildMonitorReturn,
  buildShowWithMicrophones,
  resetFixtureSequence,
} from '../fixtures/builders'

beforeEach(() => {
  resetFixtureSequence()
})

describe('normalizeAssignments', () => {
  it('creates one blank assignment per unit when none exist', () => {
    const assignments = normalizeAssignments(undefined, 3)
    expect(assignments).toHaveLength(3)
    expect(assignments.every((a) => a.use === '')).toBe(true)
  })

  it('preserves the earliest existing assignments when quantity is reduced', () => {
    const existing = [
      { id: 'a1', use: 'Lead vocal' },
      { id: 'a2', use: 'Backing vocal' },
      { id: 'a3', use: 'Spare' },
    ]
    const assignments = normalizeAssignments(existing, 2)
    expect(assignments.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(assignments.map((a) => a.use)).toEqual(['Lead vocal', 'Backing vocal'])
  })

  it('adds blank assignments when quantity increases', () => {
    const existing = [{ id: 'a1', use: 'Lead vocal' }]
    const assignments = normalizeAssignments(existing, 2)
    expect(assignments).toHaveLength(2)
    expect(assignments[1].use).toBe('')
  })
})

describe('generatedRowsFromEquipment', () => {
  it('creates one row per assignment of included equipment, in category/order sequence', () => {
    const show = buildShowWithMicrophones()
    const rows = generatedRowsFromEquipment(show, 1)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.use)).toEqual(['Lead vocal', 'Backing vocal'])
    expect(rows.map((r) => r.equipment)).toEqual(['SM58', 'SM58'])
    expect(rows.map((r) => r.channel)).toEqual(['1', '2'])
  })

  it('excludes equipment explicitly marked out of the Input List', () => {
    const show = buildShowWithMicrophones()
    show.equipment[0].includeInInputList = false
    const rows = generatedRowsFromEquipment(show, 1)
    expect(rows).toHaveLength(0)
  })

  it('retains provenance ids so synchronization can match rows back to assignments', () => {
    const show = buildShowWithMicrophones()
    const rows = generatedRowsFromEquipment(show, 1)
    expect(rows.every((r) => r.sourceEquipmentId && r.sourceAssignmentId)).toBe(true)
  })
})

describe('previewInputListSync', () => {
  it('preserves manually edited use/equipment values on retained rows', () => {
    const show = buildShowWithMicrophones()
    const [assignment] = show.equipment[0].assignments!
    show.inputList = buildInputListStartingAt17()
    show.inputList.rows = [
      buildInputListRow({
        channel: '17',
        use: 'EDITED BY USER',
        equipment: 'SM58',
        sourceEquipmentId: show.equipment[0].id,
        sourceAssignmentId: assignment.id,
        sourceEquipmentName: 'SM58',
        sourceUse: assignment.use,
      }),
    ]

    const preview = previewInputListSync(show)
    const retainedRow = preview.next.rows.find((r) => r.sourceAssignmentId === assignment.id)
    expect(retainedRow?.use).toBe('EDITED BY USER')
  })

  it('preserves manual (non-generated) rows untouched', () => {
    const show = buildShowWithMicrophones()
    show.inputList = buildMixedInputList()
    const manualRow = show.inputList.rows.find((r) => !r.sourceAssignmentId)!

    const preview = previewInputListSync(show)
    expect(preview.next.rows.some((r) => r.id === manualRow.id && r.use === manualRow.use)).toBe(true)
  })

  it('flags removals for generated rows whose source assignment no longer exists', () => {
    const show = buildShowWithMicrophones()
    show.inputList = buildMixedInputList()
    // The mixed fixture references an assignment id that does not exist on this show's equipment.
    const preview = previewInputListSync(show)
    expect(preview.removals.length).toBeGreaterThan(0)
  })

  it('adds new generated rows continuing from the highest existing channel', () => {
    const show = buildShowWithMicrophones()
    show.inputList = buildInputListStartingAt17()
    const preview = previewInputListSync(show)
    expect(preview.additions.every((row) => Number(row.channel) >= 19)).toBe(true)
  })
})

describe('nextInputChannel', () => {
  it('continues from the highest numeric channel', () => {
    const rows = [buildInputListRow({ channel: '4' }), buildInputListRow({ channel: '9' })]
    expect(nextInputChannel(rows, 1)).toBe(10)
  })

  it('ignores non-numeric channel labels', () => {
    const rows = [buildInputListRow({ channel: 'SPARE' }), buildInputListRow({ channel: '3' })]
    expect(nextInputChannel(rows, 1)).toBe(4)
  })

  it('falls back to the provided start when there are no numeric channels', () => {
    const rows = [buildInputListRow({ channel: 'SPARE' })]
    expect(nextInputChannel(rows, 17)).toBe(17)
  })
})

describe('renumberInputRows', () => {
  it('renumbers all rows consecutively from the given start', () => {
    const rows = [buildInputListRow({ channel: '5' }), buildInputListRow({ channel: '99' })]
    const renumbered = renumberInputRows(rows, 10)
    expect(renumbered.map((r) => r.channel)).toEqual(['10', '11'])
  })
})

describe('monitor returns', () => {
  it('gives a mono return a single-number output label', () => {
    const item = buildMonitorReturn({ stereo: false, outputStart: 3 })
    expect(outputLabel(item)).toBe('AUX 3')
  })

  it('gives a stereo return a range output label', () => {
    const item = buildMonitorReturn({ stereo: true, outputStart: 3 })
    expect(outputLabel(item)).toBe('AUX 3–4')
  })

  it('computes the next free output after a stereo return', () => {
    const returns = [buildMonitorReturn({ stereo: true, outputStart: 1 })]
    expect(nextReturnOutput(returns)).toBe(3)
  })

  it('computes the next free output after a mono return', () => {
    const returns = [buildMonitorReturn({ stereo: false, outputStart: 1 })]
    expect(nextReturnOutput(returns)).toBe(2)
  })
})

describe('buildEquipmentItem fixture', () => {
  it('produces one assignment per unit of quantity by default', () => {
    const item = buildEquipmentItem({ quantity: 4 })
    expect(item.assignments).toHaveLength(4)
  })
})
