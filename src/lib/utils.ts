import type { DateFormat, ScheduleItem, TimeFormat } from '../types'

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

export function isAppSnapshot(value: unknown): value is import('../types').AppSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    (candidate.version === 1 || candidate.version === 2 || candidate.version === 3) &&
    Array.isArray(candidate.shows) &&
    Array.isArray(candidate.presets) &&
    typeof candidate.library === 'object' &&
    typeof candidate.preferences === 'object'
  )
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
