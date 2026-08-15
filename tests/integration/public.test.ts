/**
 * Real Supabase integration tests for the public read-only Show route (D-219).
 *
 * Reads go through `orion_public_show` using a never-authenticated client, because that is exactly
 * what a visitor holding a public link has. Skips itself when no reachable instance is configured.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newAnonymousClient, newTestClient, uniqueId } from './env'

const config = await getSupabaseTestConfig()

const showData = (id: string, name = 'Public Show') => ({
  id,
  name,
  archived: false,
  equipmentCategories: [],
  equipment: [],
  people: [],
  schedule: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe.skipIf(!config)('Public Show lookup against a real Supabase instance', () => {
  /** Authenticated: creating and deleting Shows is an editor action. */
  let client: SupabaseClient
  /** Publishable key only: what a public visitor holds. */
  let visitor: SupabaseClient
  const createdIds: string[] = []

  beforeAll(async () => {
    client = await newTestClient(config!)
    visitor = newAnonymousClient(config!)
  })

  afterEach(async () => {
    while (createdIds.length) await client.from('orion_shows').delete().eq('id', createdIds.pop()!)
  })

  async function createShow(name?: string) {
    const id = uniqueId('pub-show')
    const slug = uniqueId('pub-slug')
    createdIds.push(id)
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: showData(id, name),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-public-setup',
    })
    return { id, slug, revision: created.data[0].revision as number }
  }

  it('7. an active Show is readable by its public_slug without a session', async () => {
    const { id, slug } = await createShow()

    const { data, error } = await visitor.rpc('orion_public_show', { p_slug: slug })

    expect(error).toBeNull()
    expect(data[0].id).toBe(id)
    expect(data[0].data.name).toBe('Public Show')
  })

  it('archiving keeps the Show readable by its public_slug (D-213)', async () => {
    const { id, slug, revision } = await createShow()
    await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: { ...showData(id), archived: true },
      p_archived: true,
      p_expected_revision: revision,
      p_client_id: 'client-public-setup',
    })

    const { data } = await visitor.rpc('orion_public_show', { p_slug: slug })

    expect(data[0].id).toBe(id)
    expect(data[0].archived).toBe(true)
  })

  it('a deleted Show is no longer found by its public_slug', async () => {
    const { id, slug, revision } = await createShow()
    await client.rpc('orion_delete_show', { p_id: id, p_expected_revision: revision, p_client_id: 'client-public-setup' })
    createdIds.pop()

    const { data } = await visitor.rpc('orion_public_show', { p_slug: slug })

    expect(data).toEqual([])
  })

  it('an unknown slug returns nothing rather than an error', async () => {
    const { data, error } = await visitor.rpc('orion_public_show', { p_slug: uniqueId('no-existe') })

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('the accessor never returns more than the requested Show, so a link stays scoped to one slug', async () => {
    const first = await createShow('Primero')
    await createShow('Segundo')

    const { data } = await visitor.rpc('orion_public_show', { p_slug: first.slug })

    expect(data).toHaveLength(1)
    expect(data[0].id).toBe(first.id)
  })
})
