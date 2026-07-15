/**
 * Real Supabase integration tests for the public read-only Show lookup by
 * slug: available while active/archived, not found once deleted. Skips
 * itself when no reachable instance is configured.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newTestClient, uniqueId } from './env'

const config = await getSupabaseTestConfig()

describe.skipIf(!config)('Public Show lookup against a real Supabase instance', () => {
  let client: SupabaseClient
  const createdIds: string[] = []

  beforeAll(() => {
    client = newTestClient(config!)
  })

  afterEach(async () => {
    while (createdIds.length) await client.from('orion_shows').delete().eq('id', createdIds.pop()!)
  })

  it('7. an active Show is readable by its public_slug', async () => {
    const id = uniqueId('pub-show')
    const slug = uniqueId('pub-slug')
    createdIds.push(id)
    await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: { id, name: 'Public Show', archived: false, equipmentCategories: [], equipment: [], people: [], schedule: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-public-setup',
    })

    const { data } = await client.from('orion_shows').select('id,data,archived').eq('public_slug', slug).maybeSingle()
    expect(data?.id).toBe(id)
    expect((data?.data as { name?: string })?.name).toBe('Public Show')
  })

  it('archiving keeps the Show readable by its public_slug', async () => {
    const id = uniqueId('pub-show')
    const slug = uniqueId('pub-slug')
    createdIds.push(id)
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: { id, name: 'Public Show', archived: false, equipmentCategories: [], equipment: [], people: [], schedule: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-public-setup',
    })
    await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: { id, name: 'Public Show', archived: true },
      p_archived: true,
      p_expected_revision: created.data[0].revision,
      p_client_id: 'client-public-setup',
    })

    const { data } = await client.from('orion_shows').select('id,archived').eq('public_slug', slug).maybeSingle()
    expect(data?.id).toBe(id)
    expect(data?.archived).toBe(true)
  })

  it('a deleted Show is no longer found by its public_slug', async () => {
    const id = uniqueId('pub-show')
    const slug = uniqueId('pub-slug')
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: { id, name: 'Public Show', archived: false, equipmentCategories: [], equipment: [], people: [], schedule: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-public-setup',
    })
    await client.rpc('orion_delete_show', { p_id: id, p_expected_revision: created.data[0].revision, p_client_id: 'client-public-setup' })

    const { data } = await client.from('orion_shows').select('id').eq('public_slug', slug).maybeSingle()
    expect(data).toBeNull()
  })
})
