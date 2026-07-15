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

  it(
    '8. delivers an INSERT on orion_shows to a second client subscribed via Realtime',
    async () => {
      const id = uniqueId('rt-show')
      const slug = uniqueId('rt-slug')

      const received = new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for Realtime INSERT event')), 25_000)
        channel = listener
          .channel(`test-orion-shows-${id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orion_shows' }, (payload) => {
            if ((payload.new as { id?: string }).id === id) {
              clearTimeout(timeout)
              resolve(payload.new as Record<string, unknown>)
            }
          })
          .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(timeout)
              reject(new Error(`Realtime channel ${status}: ${error?.message ?? 'no further detail'}`))
              return
            }
            if (status !== 'SUBSCRIBED') return
            // A freshly started local Realtime server needs a brief moment after
            // reporting SUBSCRIBED to finish attaching its logical replication
            // slot; writing immediately can race that attachment and miss the
            // change entirely.
            setTimeout(() => {
              void writer.rpc('orion_save_show', {
                p_id: id,
                p_public_slug: slug,
                p_data: { id, name: 'Realtime Show', archived: false, equipmentCategories: [], equipment: [], people: [], schedule: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                p_archived: false,
                p_expected_revision: 0,
                p_client_id: 'client-realtime-writer',
              })
            }, 1_000)
          })
      })

      const event = await received
      expect(event.id).toBe(id)

      await writer.from('orion_shows').delete().eq('id', id)
    },
    30_000,
  )
})
