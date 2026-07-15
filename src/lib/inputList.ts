import type {
  EquipmentAssignment,
  InputListConfig,
  InputListRow,
  MonitorReturn,
  Show,
  ShowEquipmentItem,
} from '../types'
import { clone, now, uid } from './utils'

export interface InputListSyncPreview {
  additions: InputListRow[]
  removals: InputListRow[]
  updates: Array<{ before: InputListRow; after: InputListRow }>
  next: InputListConfig
}

export function normalizeAssignments(
  assignments: EquipmentAssignment[] | undefined,
  quantity: number,
): EquipmentAssignment[] {
  const safeQuantity = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0))
  const current = Array.isArray(assignments) ? assignments : []
  return Array.from({ length: safeQuantity }, (_, index) => {
    const existing = current[index]
    return existing ? { id: existing.id || uid(), use: existing.use || '' } : { id: uid(), use: '' }
  })
}

export function normalizeEquipmentItem(item: ShowEquipmentItem): ShowEquipmentItem {
  const quantity = Math.max(0, Math.floor(Number.isFinite(item.quantity) ? item.quantity : 0))
  return {
    ...item,
    quantity,
    includeInInputList: item.includeInInputList !== false,
    assignments: normalizeAssignments(item.assignments, quantity),
  }
}

export function normalizeInputList(config: InputListConfig | undefined): InputListConfig | undefined {
  if (!config) return undefined
  const firstStoredChannel = (config.rows || [])
    .map((row) => Number.parseInt(String(row.channel || ''), 10))
    .find((value) => Number.isFinite(value) && value > 0)
  const channelStart = Math.max(1, Math.floor(config.channelStart || firstStoredChannel || 1))
  return {
    ...config,
    channelStart,
    rows: (config.rows || []).map((row, order) => ({
      ...row,
      id: row.id || uid(),
      order,
      channel: String(row.channel || channelStart + order),
      use: row.use || '',
      equipment: row.equipment || '',
      phantom: Boolean(row.phantom),
    })),
    returns: (config.returns || []).map((item, order) => ({
      ...item,
      id: item.id || uid(),
      order,
      destination: item.destination || '',
      system: item.system || '',
      stereo: Boolean(item.stereo),
      outputStart: Math.max(1, Math.floor(item.outputStart || 1)),
    })),
    createdAt: config.createdAt || now(),
    updatedAt: config.updatedAt || now(),
  }
}

export function generatedRowsFromEquipment(show: Show, channelStart = 1): InputListRow[] {
  const categoryOrder = new Map(show.equipmentCategories.map((category) => [category.id, category.order]))
  return show.equipment
    .filter((item) => item.includeInInputList !== false)
    .sort((a, b) => (categoryOrder.get(a.categoryId) ?? 0) - (categoryOrder.get(b.categoryId) ?? 0) || a.order - b.order)
    .flatMap((rawItem) => {
      const item = normalizeEquipmentItem(rawItem)
      return (item.assignments || []).map((assignment) => ({
        id: uid(),
        order: 0,
        channel: '',
        use: assignment.use,
        equipment: item.name,
        phantom: false,
        sourceEquipmentId: item.id,
        sourceAssignmentId: assignment.id,
        sourceEquipmentName: item.name,
        sourceUse: assignment.use,
      }))
    })
    .map((row, order) => ({ ...row, order, channel: String(channelStart + order) }))
}

export function createInputList(show: Show): InputListConfig {
  const timestamp = now()
  return {
    rows: generatedRowsFromEquipment(show, 1),
    channelStart: 1,
    returns: [],
    generalNotes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSyncedAt: timestamp,
  }
}

function generatedKey(row: InputListRow) {
  return row.sourceAssignmentId || ''
}

export function previewInputListSync(show: Show): InputListSyncPreview {
  const current = normalizeInputList(show.inputList) || createInputList(show)
  const generated = generatedRowsFromEquipment(show, current.channelStart)
  const generatedByKey = new Map(generated.map((row) => [generatedKey(row), row]))
  const currentByKey = new Map(
    current.rows.filter((row) => row.sourceAssignmentId).map((row) => [generatedKey(row), row]),
  )

  const removals = current.rows.filter(
    (row) => row.sourceAssignmentId && !generatedByKey.has(generatedKey(row)),
  )
  const firstNewChannel = nextInputChannel(current.rows, current.channelStart)
  const additions = generated
    .filter((row) => !currentByKey.has(generatedKey(row)))
    .map((row, index) => ({ ...row, channel: String(firstNewChannel + index) }))
  const updates: Array<{ before: InputListRow; after: InputListRow }> = []

  const retained = current.rows
    .filter((row) => !row.sourceAssignmentId || generatedByKey.has(generatedKey(row)))
    .map((row) => {
      if (!row.sourceAssignmentId) return row
      const source = generatedByKey.get(generatedKey(row))
      if (!source) return row
      const equipmentWasEdited = row.equipment !== (row.sourceEquipmentName ?? row.equipment)
      const useWasEdited = row.use !== (row.sourceUse ?? row.use)
      const after: InputListRow = {
        ...row,
        equipment: equipmentWasEdited ? row.equipment : source.equipment,
        use: useWasEdited ? row.use : source.use,
        sourceEquipmentId: source.sourceEquipmentId,
        sourceEquipmentName: source.equipment,
        sourceUse: source.use,
      }
      if (
        after.equipment !== row.equipment ||
        after.use !== row.use ||
        after.sourceEquipmentName !== row.sourceEquipmentName ||
        after.sourceUse !== row.sourceUse
      ) {
        updates.push({ before: row, after })
      }
      return after
    })

  const timestamp = now()
  const next: InputListConfig = {
    ...clone(current),
    rows: [...retained, ...additions].map((row, order) => ({ ...row, order })),
    updatedAt: timestamp,
    lastSyncedAt: timestamp,
  }
  return { additions, removals, updates, next }
}

export function nextInputChannel(rows: InputListRow[], fallbackStart = 1) {
  const numericChannels = rows
    .map((row) => Number.parseInt(String(row.channel || ''), 10))
    .filter((value) => Number.isFinite(value) && value > 0)
  return numericChannels.length ? Math.max(...numericChannels) + 1 : Math.max(1, fallbackStart)
}

export function renumberInputRows(rows: InputListRow[], channelStart: number) {
  const start = Math.max(1, Math.floor(channelStart || 1))
  return rows.map((row, index) => ({ ...row, channel: String(start + index) }))
}

export function nextReturnOutput(returns: MonitorReturn[]) {
  return returns.reduce((highest, item) => {
    const end = item.outputStart + (item.stereo ? 1 : 0)
    return Math.max(highest, end)
  }, 0) + 1
}

export function outputLabel(item: MonitorReturn) {
  return item.stereo ? `AUX ${item.outputStart}–${item.outputStart + 1}` : `AUX ${item.outputStart}`
}
