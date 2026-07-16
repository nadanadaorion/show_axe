/**
 * Real Supabase Realtime integration test: a change made by one client is
 * delivered to a second client's subscription. Skips itself when no
 * reachable instance is configured.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newTestClient, uniqueId } from './env'

const config = await getSupabaseTestConfig()

describe.skipIf(!config)('Realtime propagation against a real Supabase instance', () => {
  let writer: SupabaseClient
  let listener: SupabaseClient
  let channel: RealtimeChannel | undefined

  beforeAll(() => {
    writer = newTestClient(config!)
    listener = newTestClient(config!)
  })

  afterEach(async () => {
    if (channel) await listener.removeChannel(channel)
    channel = undefined
  })

  /**
   * A single subscribe-write-listen attempt. A freshly started local
   * Realtime server can report a channel SUBSCRIBED over its websocket
   * before its own logical-replication connection has finished attaching
   * to Postgres (a known cold-start race in the local CLI stack, not
   * something a client-side delay can reliably wait out — see
   * supabase/realtime#1074 and #415). Rather than guess a "long enough"
   * fixed delay, each attempt gets a bounded window and a genuinely fresh
   * row id; the caller retries on a clean timeout.
   */
  async function attemptDelivery(attemptTimeoutMs: number): Promise<Record<string, unknown> | undefined> {
    const id = uniqueId('rt-show')
    const slug = uniqueId('rt-slug')

    try {
      return await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('__attempt_timeout__')), attemptTimeoutMs)
        channel = listener
          .channel(`test-orion-shows-${id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orion_shows' }, (payload) => {
            if ((payload.new as { id?: string }).id === id) {
              clearTimeout(timeout)
              resolve(payload.new as Record<string, unknown>)
            }
          })
          .subscribe((status, error) => {
            console.log(`[realtime test] channel status: ${status}`)
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(timeout)
              reject(new Error(`Realtime channel ${status}: ${error?.message ?? 'no further detail'}`))
              return
            }
            if (status !== 'SUBSCRIBED') return
            setTimeout(() => {
              // supabase-js never throws on a query/RPC error — it resolves with
              // { data, error } — so a fire-and-forget call here would silently
              // swallow a write failure and this test would just time out with
              // no diagnostic signal at all (indistinguishable from a genuine
              // Realtime delivery bug). Surface it explicitly instead.
              writer
                .rpc('orion_save_show', {
                  p_id: id,
                  p_public_slug: slug,
                  p_data: { id, name: 'Realtime Show', archived: false, equipmentCategories: [], equipment: [], people: [], schedule: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                  p_archived: false,
                  p_expected_revision: 0,
                  p_client_id: 'client-realtime-writer',
                })
                .then(
                  ({ error: rpcError }) => {
                    if (rpcError) {
                      clearTimeout(timeout)
                      reject(new Error(`orion_save_show RPC failed: ${rpcError.message}`))
                    }
                  },
                  (rpcError: unknown) => {
                    clearTimeout(timeout)
                    reject(rpcError instanceof Error ? rpcError : new Error(String(rpcError)))
                  },
                )
            }, 1_000)
          })
      })
    } catch (error) {
      if (channel) {
        await listener.removeChannel(channel)
        channel = undefined
      }
      await writer.from('orion_shows').delete().eq('id', id)
      if (error instanceof Error && error.message === '__attempt_timeout__') return undefined
      throw error
    }
  }

  it(
    '8. delivers an INSERT on orion_shows to a second client subscribed via Realtime',
    async () => {
      const attempts = 3
      const perAttemptTimeoutMs = 15_000
      let event: Record<string, unknown> | undefined

      for (let attempt = 1; attempt <= attempts && !event; attempt++) {
        console.log(`[realtime test] attempt ${attempt}/${attempts}`)
        event = await attemptDelivery(perAttemptTimeoutMs)
      }

      if (!event) {
        throw new Error(`Timed out waiting for Realtime INSERT event after ${attempts} attempts`)
      }

      expect(event.id).toBeDefined()

      await writer.from('orion_shows').delete().eq('id', event.id as string)
    },
    70_000,
  )

  it('9. delivers rapid Show revisions to a pre-subscribed second client without changing the highest remote state', async () => {
    const id = uniqueId('rt-monotonic-show')
    const slug = uniqueId('rt-monotonic-slug')
    const timestamp = '2026-01-01T00:00:00.000Z'
    const category = { id: 'category-audio', name: 'Audio', order: 0 }
    const equipment = {
      id: 'equipment-console',
      categoryId: category.id,
      name: 'Revision-safe console',
      quantity: 1,
      checked: false,
      order: 0,
      includeInInputList: true,
      assignments: [{ id: 'assignment-console', use: 'FOH' }],
    }
    const base = {
      id,
      publicSlug: slug,
      name: 'Monotonic Realtime Integration',
      archived: false,
      equipmentCategories: [category],
      equipment: [],
      people: [],
      schedule: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const observed: Array<{ revision: number; data: Record<string, unknown> }> = []
    let resolveHighest: (() => void) | undefined
    const highestObserved = new Promise<void>((resolve) => { resolveHighest = resolve })

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out subscribing the second Realtime client')), 15_000)
        channel = listener
          .channel(`test-orion-monotonic-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orion_shows' }, (payload) => {
            if (payload.eventType === 'DELETE') return
            const row = payload.new as { id?: string; revision?: number; data?: Record<string, unknown> }
            if (row.id !== id || typeof row.revision !== 'number') return
            observed.push({ revision: row.revision, data: row.data || {} })
            if (row.revision >= 3) resolveHighest?.()
          })
          .subscribe((status, error) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timeout)
              resolve()
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(timeout)
              reject(new Error(`Realtime channel ${status}: ${error?.message ?? 'no further detail'}`))
            }
          })
      })

      const created = await writer.rpc('orion_save_show', {
        p_id: id,
        p_public_slug: slug,
        p_data: base,
        p_archived: false,
        p_expected_revision: 0,
        p_client_id: 'client-monotonic-writer',
      })
      expect(created.error).toBeNull()
      expect(created.data[0].revision).toBe(1)

      const withEquipment = { ...base, equipment: [equipment] }
      const updated = await writer.rpc('orion_save_show', {
        p_id: id,
        p_public_slug: slug,
        p_data: withEquipment,
        p_archived: false,
        p_expected_revision: 1,
        p_client_id: 'client-monotonic-writer',
      })
      expect(updated.error).toBeNull()
      expect(updated.data[0].revision).toBe(2)

      const withInputList = {
        ...withEquipment,
        inputList: {
          rows: [{ id: 'row-console', order: 0, channel: '1', use: 'FOH', equipment: equipment.name, phantom: false }],
          channelStart: 1,
          returns: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      }
      const finalWrite = await writer.rpc('orion_save_show', {
        p_id: id,
        p_public_slug: slug,
        p_data: withInputList,
        p_archived: false,
        p_expected_revision: 2,
        p_client_id: 'client-monotonic-writer',
      })
      expect(finalWrite.error).toBeNull()
      expect(finalWrite.data[0].revision).toBe(3)

      await Promise.race([
        highestObserved,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Second client did not observe revision 3')), 20_000)),
      ])

      const { data: remote, error } = await writer.from('orion_shows').select('data,revision').eq('id', id).maybeSingle()
      expect(error).toBeNull()
      expect(remote?.revision).toBe(3)
      expect((remote?.data as typeof withInputList).equipment[0].name).toBe('Revision-safe console')
      expect(observed.some((row) => row.revision === 3 && (row.data as typeof withInputList).equipment?.[0]?.name === 'Revision-safe console')).toBe(true)
    } finally {
      await writer.from('orion_shows').delete().eq('id', id)
    }
  }, 45_000)
})
