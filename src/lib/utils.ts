import type { AppSnapshot, DateFormat, ScheduleItem, TimeFormat } from '../types'

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const now = () => new Date().toISOString()

export const clone = <T,>(value: T): T => structuredClone(value)

export function formatDate(value: string | undefined, format: DateFormat) {
  if (!value) return 'Sin fecha'
  const [year, month, day] = value.split('-')
  if (format === 'MM/dd/yyyy') return `${month}/${day}/${year}`
  if (format === 'yyyy-MM-dd') return `${year}-${month}-${day}`
  return `${day}/${month}/${year}`
}

export function formatTime(value: string | undefined, format: TimeFormat) {
  if (!value) return 'Sin hora'
  if (format === '24h') return value
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function scheduleDuration(item: ScheduleItem, next?: ScheduleItem) {
  const end = item.endTime || next?.startTime
  if (!end || !item.startTime) return ''
  const [sh, sm] = item.startTime.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

type ValidationResult = { valid: true; snapshot: AppSnapshot } | { valid: false; error: string }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isString = (value: unknown) => typeof value === 'string'
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString)
const optionalString = (value: unknown) => value === undefined || isString(value)
const namedRecord = (value: unknown) => isRecord(value) && isString(value.id) && isString(value.name)
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean'

function validEquipment(value: unknown) {
  return isRecord(value) && isString(value.id) && isString(value.categoryId) && isString(value.name) &&
    isNumber(value.quantity) && typeof value.checked === 'boolean' && isNumber(value.order) &&
    (value.assignments === undefined || (Array.isArray(value.assignments) && value.assignments.every((item) =>
      isRecord(item) && isString(item.id) && isString(item.use))))
}

function validPerson(value: unknown) {
  return isRecord(value) && isString(value.id) && isString(value.name) && isNumber(value.order) &&
    isStringArray(value.typeNames) && isStringArray(value.roleNames) && isStringArray(value.phones) && isStringArray(value.emails)
}

function validSchedule(value: unknown) {
  return isRecord(value) && isString(value.id) && isString(value.name) && isString(value.startTime) && isNumber(value.order)
}

function validInputList(value: unknown) {
  if (value === undefined) return true
  if (!isRecord(value) || !Array.isArray(value.rows) || !Array.isArray(value.returns) || !isNumber(value.channelStart)) return false
  return value.rows.every((row) => isRecord(row) && isString(row.id) && isNumber(row.order) && isString(row.channel) &&
    isString(row.use) && isString(row.equipment) && typeof row.phantom === 'boolean' && optionalString(row.patch) && optionalString(row.notes)) &&
    value.returns.every((item) => isRecord(item) && isString(item.id) && isNumber(item.order) && isString(item.destination) &&
      isString(item.system) && typeof item.stereo === 'boolean' && isNumber(item.outputStart))
}

function validShow(value: unknown) {
  return isRecord(value) && isString(value.id) && isString(value.name) && typeof value.archived === 'boolean' &&
    Array.isArray(value.equipmentCategories) && value.equipmentCategories.every((item) => namedRecord(item) && isNumber(item.order)) &&
    Array.isArray(value.equipment) && value.equipment.every(validEquipment) && Array.isArray(value.people) && value.people.every(validPerson) &&
    Array.isArray(value.schedule) && value.schedule.every(validSchedule) && validInputList(value.inputList)
}

function validPreset(value: unknown) {
  return isRecord(value) && namedRecord(value) && typeof value.archived === 'boolean' &&
    Array.isArray(value.equipmentCategories) && value.equipmentCategories.every((item) => namedRecord(item) && isNumber(item.order)) &&
    Array.isArray(value.equipment) && value.equipment.every(validEquipment) && Array.isArray(value.people) && value.people.every(validPerson) &&
    Array.isArray(value.schedule) && value.schedule.every(validSchedule)
}

function validLibrary(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.equipment) || !Array.isArray(value.people) ||
      !Array.isArray(value.categories) || !Array.isArray(value.roles) || !Array.isArray(value.personTypes) ||
      !Array.isArray(value.origins)) return false
  return value.equipment.every((item) => namedRecord(item) && optionalString(item.categoryId) && optionalString(item.unit) && optionalString(item.originId)) &&
    value.people.every((item) => namedRecord(item) && optionalString(item.company) && isStringArray(item.typeIds) &&
      isStringArray(item.roleIds) && isStringArray(item.phones) && isStringArray(item.emails)) &&
    value.categories.every((item) => namedRecord(item) && isNumber(item.order)) &&
    value.roles.every(namedRecord) && value.personTypes.every(namedRecord) && value.origins.every(namedRecord)
}

function validPreferences(value: unknown) {
  if (!isRecord(value)) return false
  return (value.dateFormat === undefined || ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'].includes(String(value.dateFormat))) &&
    (value.timeFormat === undefined || ['24h', '12h'].includes(String(value.timeFormat))) &&
    (value.language === undefined || ['es', 'en'].includes(String(value.language))) &&
    (value.initialModule === undefined || ['shows', 'library', 'presets'].includes(String(value.initialModule))) &&
    (value.theme === undefined || ['light', 'dark', 'system'].includes(String(value.theme))) &&
    optionalBoolean(value.showInputListWarnings)
}

export function validateAppSnapshot(value: unknown): ValidationResult {
  if (!isRecord(value)) return { valid: false, error: 'El archivo no contiene un objeto de respaldo.' }
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return { valid: false, error: 'La versión del respaldo no es compatible con Ori♡n Shows V2.' }
  if (!isString(value.exportedAt) || !Array.isArray(value.shows) || !value.shows.every(validShow) ||
      !Array.isArray(value.presets) || !value.presets.every(validPreset)) {
    return { valid: false, error: 'El respaldo contiene Shows o Presets incompletos o incompatibles.' }
  }
  if (!validLibrary(value.library)) {
    return { valid: false, error: 'La Biblioteca del respaldo está incompleta o dañada.' }
  }
  if (!validPreferences(value.preferences)) return { valid: false, error: 'Las Preferencias del respaldo no son válidas.' }
  return { valid: true, snapshot: value as unknown as AppSnapshot }
}

export function isAppSnapshot(value: unknown): value is AppSnapshot {
  return validateAppSnapshot(value).valid
}

export const createPublicSlug = () => `show-${uid().replace(/-/g, '').slice(0, 20)}`

export function getClientId() {
  const key = 'orion-shows:v2-client-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = uid()
    localStorage.setItem(key, id)
  }
  return id
}

export function getDeviceLabel() {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo'
  return `${browser} · ${os}`
}
