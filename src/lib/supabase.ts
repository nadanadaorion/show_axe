import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { getRuntimeConfig, isRuntimeConfigured } from './config'
import { normalizeAssignments, normalizeEquipmentItem, normalizeInputList } from './inputList'
import type { Show, WorkspaceData } from '../types'

export interface RemoteShowRow {
  id: string
  public_slug: string
  data: Record<string, unknown>
  archived: boolean
  revision: number
  updated_at: string
}

export interface RemoteWorkspaceRow {
  id: 'main'
  data: WorkspaceData
  revision: number
  updated_at: string
}

export interface RemoteWriteResult<T> {
  applied: boolean
  reason: 'saved' | 'conflict' | 'locked' | 'missing' | string
  row?: T
}

export interface RemoteLockResult {
  acquired: boolean
  ownerClientId?: string
  deviceLabel?: string
  expiresAt?: string
}

let client: SupabaseClient | undefined

export function getSupabase(): SupabaseClient | undefined {
  if (!isRuntimeConfigured()) return undefined
  if (!client) {
    const config = getRuntimeConfig()
    client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  }
  return client
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return undefined
}

export function remoteRowToShow(row: RemoteShowRow): Show {
  const data = (row.data || {}) as Partial<Show>
  return {
    id: row.id,
    publicSlug: row.public_slug,
    name: typeof data.name === 'string' ? data.name : 'Show sin nombre',
    date: data.date,
    time: data.time,
    showType: data.showType,
    note: data.note,
    archived: row.archived,
    equipmentCategories: data.equipmentCategories || [],
    equipment: (data.equipment || []).map((item) => ({
      ...normalizeEquipmentItem(item),
      assignments: normalizeAssignments(item.assignments, item.quantity),
    })),
    people: data.people || [],
    schedule: data.schedule || [],
    inputList: normalizeInputList(data.inputList),
    createdAt: data.createdAt || row.updated_at,
    updatedAt: row.updated_at,
  }
}

function parseShowWrite(data: unknown): RemoteWriteResult<RemoteShowRow> {
  const record = firstRecord(data)
  if (!record) return { applied: false, reason: 'missing' }
  const row = record.row_data && typeof record.row_data === 'object'
    ? record.row_data as RemoteShowRow
    : record.id
      ? {
          id: String(record.id),
          public_slug: String(record.public_slug || ''),
          data: (record.data || {}) as Record<string, unknown>,
          archived: Boolean(record.archived),
          revision: asNumber(record.revision),
          updated_at: String(record.updated_at || new Date().toISOString()),
        }
      : undefined
  return { applied: Boolean(record.applied), reason: String(record.reason || 'unknown'), row }
}

export async function fetchRemoteShows() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.from('orion_shows').select('id,public_slug,data,archived,revision,updated_at').order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []) as RemoteShowRow[]
}

export async function fetchRemoteShowBySlug(slug: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.from('orion_shows').select('id,public_slug,data,archived,revision,updated_at').eq('public_slug', slug).maybeSingle()
  if (error) throw error
  return data as RemoteShowRow | null
}

export async function fetchRemoteWorkspace() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.from('orion_workspace').select('id,data,revision,updated_at').eq('id', 'main').maybeSingle()
  if (error) throw error
  return data as RemoteWorkspaceRow | null
}

export async function saveRemoteShow(show: Show, expectedRevision: number, clientId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.rpc('orion_save_show', {
    p_id: show.id,
    p_public_slug: show.publicSlug,
    p_data: show,
    p_archived: show.archived,
    p_expected_revision: expectedRevision,
    p_client_id: clientId,
  })
  if (error) throw error
  return parseShowWrite(data)
}

export async function deleteRemoteShow(showId: string, expectedRevision: number, clientId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.rpc('orion_delete_show', {
    p_id: showId,
    p_expected_revision: expectedRevision,
    p_client_id: clientId,
  })
  if (error) throw error
  return parseShowWrite(data)
}

export async function saveRemoteWorkspace(workspace: WorkspaceData, expectedRevision: number) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.rpc('orion_save_workspace', {
    p_data: workspace,
    p_expected_revision: expectedRevision,
  })
  if (error) throw error
  const record = firstRecord(data)
  if (!record) return { applied: false, reason: 'missing' } as RemoteWriteResult<RemoteWorkspaceRow>
  const row: RemoteWorkspaceRow | undefined = record.id ? {
    id: 'main',
    data: (record.data || {}) as WorkspaceData,
    revision: asNumber(record.revision),
    updated_at: String(record.updated_at || new Date().toISOString()),
  } : undefined
  return { applied: Boolean(record.applied), reason: String(record.reason || 'unknown'), row } as RemoteWriteResult<RemoteWorkspaceRow>
}

export async function acquireRemoteLock(showId: string, clientId: string, deviceLabel: string, inactiveSeconds = 0) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.rpc('orion_acquire_show_lock', {
    p_show_id: showId,
    p_client_id: clientId,
    p_device_label: deviceLabel,
    p_inactive_seconds: Math.max(0, Math.floor(inactiveSeconds)),
  })
  if (error) throw error
  const record = firstRecord(data)
  return {
    acquired: Boolean(record?.acquired),
    ownerClientId: record?.owner_client_id ? String(record.owner_client_id) : undefined,
    deviceLabel: record?.device_label ? String(record.device_label) : undefined,
    expiresAt: record?.expires_at ? String(record.expires_at) : undefined,
  } satisfies RemoteLockResult
}

export async function releaseRemoteLock(showId: string, clientId: string) {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.rpc('orion_release_show_lock', { p_show_id: showId, p_client_id: clientId })
  if (error) throw error
}


export function releaseRemoteLockKeepalive(showId: string, clientId: string) {
  if (!isRuntimeConfigured()) return
  const config = getRuntimeConfig()
  void fetch(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/orion_release_show_lock`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${config.supabasePublishableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_show_id: showId, p_client_id: clientId }),
  }).catch(() => undefined)
}

export function subscribeToRemoteChanges(handlers: {
  onShowUpsert: (row: RemoteShowRow) => void
  onShowDelete: (id: string) => void
  onWorkspace: (row: RemoteWorkspaceRow) => void
  onStatus?: (status: string, error?: unknown) => void
}): RealtimeChannel | undefined {
  const supabase = getSupabase()
  if (!supabase) return undefined
  return supabase
    .channel(`orion-shows-v2-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orion_shows' }, (payload) => handlers.onShowUpsert(payload.new as RemoteShowRow))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orion_shows' }, (payload) => handlers.onShowUpsert(payload.new as RemoteShowRow))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orion_shows' }, (payload) => handlers.onShowDelete(String((payload.old as { id?: string }).id || '')))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orion_workspace', filter: 'id=eq.main' }, (payload) => {
      if (payload.eventType !== 'DELETE') handlers.onWorkspace(payload.new as RemoteWorkspaceRow)
    })
    .subscribe((status, error) => handlers.onStatus?.(status, error))
}

export async function removeRemoteChannel(channel: RealtimeChannel | undefined) {
  const supabase = getSupabase()
  if (supabase && channel) await supabase.removeChannel(channel)
}
