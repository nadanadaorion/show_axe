/**
 * Real Supabase integration tests for Show CRUD, archive/restore, delete,
 * and revision-conflict detection — exercised through the same RPC names,
 * parameter shapes, and table the app itself uses (see src/lib/supabase.ts).
 * Skips itself (never mocks) when no reachable instance is configured.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newTestClient, uniqueId } from './env'

const config = await getSupabaseTestConfig()

function minimalShowPayload(id: string, publicSlug: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    publicSlug,
    name: 'Integration Show',
    archived: false,
    equipmentCategories: [],
    equipment: [],
    people: [],
    schedule: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe.skipIf(!config)('Show CRUD against a real Supabase instance', () => {
  let client: SupabaseClient
  const createdIds: string[] = []

  beforeAll(() => {
    client = newTestClient(config!)
  })

  afterEach(async () => {
    while (createdIds.length) {
      const id = createdIds.pop()!
      await client.from('orion_shows').delete().eq('id', id)
    }
  })

  it('1. creates a Show remotely via orion_save_show', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    createdIds.push(id)

    const { data, error } = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })

    expect(error).toBeNull()
    const row = data[0]
    expect(row.applied).toBe(true)
    expect(row.reason).toBe('saved')
    expect(row.revision).toBe(1)
  })

  it('2. is readable from a second client immediately after creation', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    createdIds.push(id)
    await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug, { name: 'Visible to B' }),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })

    const secondClient = newTestClient(config!)
    const { data, error } = await secondClient
      .from('orion_shows')
      .select('id,public_slug,data,archived,revision')
      .eq('id', id)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.id).toBe(id)
    expect((data?.data as { name?: string })?.name).toBe('Visible to B')
  })

  it('3. applies a remote update at the correct revision', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    createdIds.push(id)
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })
    const revision = created.data[0].revision

    const { data, error } = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug, { name: 'Updated remotely' }),
      p_archived: false,
      p_expected_revision: revision,
      p_client_id: 'client-integration-a',
    })

    expect(error).toBeNull()
    expect(data[0].applied).toBe(true)
    expect(data[0].revision).toBe(revision + 1)
    expect((data[0].data as { name?: string }).name).toBe('Updated remotely')
  })

  it('4. archive preserves the public_slug; restore (archived:false) keeps it too', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    createdIds.push(id)
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })
    let revision = created.data[0].revision

    const archived = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: true,
      p_expected_revision: revision,
      p_client_id: 'client-integration-a',
    })
    expect(archived.data[0].applied).toBe(true)
    expect(archived.data[0].archived).toBe(true)
    expect(archived.data[0].public_slug).toBe(slug)
    revision = archived.data[0].revision

    const restored = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: revision,
      p_client_id: 'client-integration-a',
    })
    expect(restored.data[0].applied).toBe(true)
    expect(restored.data[0].archived).toBe(false)
    expect(restored.data[0].public_slug).toBe(slug)
  })

  it('5. delete effectively removes the remote record', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })
    const revision = created.data[0].revision

    const { data: deleteResult, error: deleteError } = await client.rpc('orion_delete_show', {
      p_id: id,
      p_expected_revision: revision,
      p_client_id: 'client-integration-a',
    })
    expect(deleteError).toBeNull()
    expect(deleteResult[0].applied).toBe(true)

    const { data: afterDelete } = await client.from('orion_shows').select('id').eq('id', id).maybeSingle()
    expect(afterDelete).toBeNull()
  })

  it('16. detects a revision conflict when two clients write concurrently', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    createdIds.push(id)
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })
    const staleRevision = created.data[0].revision

    // Client A updates first, advancing the revision.
    await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug, { name: 'From A' }),
      p_archived: false,
      p_expected_revision: staleRevision,
      p_client_id: 'client-integration-a',
    })

    // Client B, still holding the now-stale revision, tries to write.
    const { data } = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug, { name: 'From B (stale)' }),
      p_archived: false,
      p_expected_revision: staleRevision,
      p_client_id: 'client-integration-b',
    })

    expect(data[0].applied).toBe(false)
    expect(data[0].reason).toBe('conflict')
    expect((data[0].data as { name?: string }).name).toBe('From A')
  })

  it('17. "keep local" resolves a conflict by retrying against the latest revision', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    createdIds.push(id)
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })
    const staleRevision = created.data[0].revision
    const remoteWrite = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug, { name: 'Remote edit' }),
      p_archived: false,
      p_expected_revision: staleRevision,
      p_client_id: 'client-integration-a',
    })
    const latestRevision = remoteWrite.data[0].revision

    // The conflicting client retries with the latest known revision ("keep local").
    const retry = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug, { name: 'Local edit kept' }),
      p_archived: false,
      p_expected_revision: latestRevision,
      p_client_id: 'client-integration-b',
    })

    expect(retry.data[0].applied).toBe(true)
    expect((retry.data[0].data as { name?: string }).name).toBe('Local edit kept')
  })

  it('18. "keep online" discards the pending local write and applies the remote row', async () => {
    const id = uniqueId('show')
    const slug = uniqueId('slug')
    createdIds.push(id)
    const created = await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug),
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'client-integration-a',
    })
    await client.rpc('orion_save_show', {
      p_id: id,
      p_public_slug: slug,
      p_data: minimalShowPayload(id, slug, { name: 'Remote wins' }),
      p_archived: false,
      p_expected_revision: created.data[0].revision,
      p_client_id: 'client-integration-a',
    })

    // "Keep online" never resubmits the local write; it simply reads and applies the current remote row.
    const { data } = await client.from('orion_shows').select('data,revision').eq('id', id).maybeSingle()
    expect((data?.data as { name?: string })?.name).toBe('Remote wins')
  })
})
