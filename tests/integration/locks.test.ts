/**
 * Real Supabase integration tests for the Show lock protocol: acquisition,
 * heartbeat renewal, release, ten-minute inactivity expiry, and rejecting a
 * second client's edit while the lock is held. Skips itself when no
 * reachable instance is configured.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newTestClient, uniqueId } from './env'

const config = await getSupabaseTestConfig()

describe.skipIf(!config)('Show lock protocol against a real Supabase instance', () => {
  let client: SupabaseClient
  let showId: string

  beforeAll(() => {
    client = newTestClient(config!)
  })

  beforeEach(async () => {
    showId = uniqueId('lock-show')
    await client.rpc('orion_save_show', {
      p_id: showId,
      p_public_slug: uniqueId('lock-slug'),
      p_data: { id: showId, name: 'Lock Test Show', archived: false, equipmentCategories: [], equipment: [], people: [], schedule: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-setup',
    })
  })

  afterEach(async () => {
    await client.from('orion_shows').delete().eq('id', showId)
  })

  it('9. a client acquires the lock when opening a Show', async () => {
    const { data, error } = await client.rpc('orion_acquire_show_lock', {
      p_show_id: showId,
      p_client_id: 'device-a',
      p_device_label: 'Chrome · macOS',
      p_inactive_seconds: 0,
    })
    expect(error).toBeNull()
    expect(data[0].acquired).toBe(true)
    expect(data[0].owner_client_id).toBe('device-a')
  })

  it('10. the owning client renews (heartbeats) its own lock', async () => {
    await client.rpc('orion_acquire_show_lock', { p_show_id: showId, p_client_id: 'device-a', p_device_label: 'Chrome · macOS', p_inactive_seconds: 0 })

    const { data } = await client.rpc('orion_acquire_show_lock', {
      p_show_id: showId,
      p_client_id: 'device-a',
      p_device_label: 'Chrome · macOS',
      p_inactive_seconds: 10,
    })
    expect(data[0].acquired).toBe(true)
    expect(data[0].owner_client_id).toBe('device-a')
  })

  it('11. releasing the lock lets another client acquire it', async () => {
    await client.rpc('orion_acquire_show_lock', { p_show_id: showId, p_client_id: 'device-a', p_device_label: 'Chrome · macOS', p_inactive_seconds: 0 })
    const { data: released } = await client.rpc('orion_release_show_lock', { p_show_id: showId, p_client_id: 'device-a' })
    expect(released).toBe(true)

    const { data } = await client.rpc('orion_acquire_show_lock', { p_show_id: showId, p_client_id: 'device-b', p_device_label: 'Firefox · Windows', p_inactive_seconds: 0 })
    expect(data[0].acquired).toBe(true)
    expect(data[0].owner_client_id).toBe('device-b')
  })

  it('12. a lock expires after the ten-minute inactivity ceiling', async () => {
    // Acquiring at the 600s (10 min) inactivity ceiling makes the lock expire immediately.
    const { data: acquired } = await client.rpc('orion_acquire_show_lock', {
      p_show_id: showId,
      p_client_id: 'device-a',
      p_device_label: 'Chrome · macOS',
      p_inactive_seconds: 600,
    })
    expect(acquired[0].acquired).toBe(true)
    expect(new Date(acquired[0].expires_at).getTime()).toBeLessThanOrEqual(Date.now() + 1_000)

    await new Promise((resolve) => setTimeout(resolve, 1_200))

    const { data: takeover } = await client.rpc('orion_acquire_show_lock', {
      p_show_id: showId,
      p_client_id: 'device-b',
      p_device_label: 'Firefox · Windows',
      p_inactive_seconds: 0,
    })
    expect(takeover[0].acquired).toBe(true)
    expect(takeover[0].owner_client_id).toBe('device-b')
  })

  it('13. a second client is rejected from saving while the lock is held', async () => {
    await client.rpc('orion_acquire_show_lock', { p_show_id: showId, p_client_id: 'device-a', p_device_label: 'Chrome · macOS', p_inactive_seconds: 0 })

    const { data } = await client.rpc('orion_save_show', {
      p_id: showId,
      p_public_slug: uniqueId('should-not-apply'),
      p_data: { id: showId, name: 'Blocked write' },
      p_archived: false,
      p_expected_revision: 1,
      p_client_id: 'device-b',
    })

    expect(data[0].applied).toBe(false)
    expect(data[0].reason).toBe('locked')
  })
})
