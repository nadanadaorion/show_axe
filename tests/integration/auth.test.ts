/**
 * Real Supabase integration tests for the authorisation model (D-215/D-216).
 *
 * This is the suite that would catch the model silently reopening: a policy edited back to
 * `using (true)`, a grant restored to `anon`, or a new RPC granted too broadly. Every claim here is
 * made against a real PostgREST, not a mock, because the failure mode being guarded against is
 * precisely one where the client code is irrelevant.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseTestConfig, newAnonymousClient, newTestClient } from './env'

const config = await getSupabaseTestConfig()
const authenticated = Boolean(config?.email && config?.password)

describe.skipIf(!config)('Authorisation foundation against a real Supabase instance', () => {
  let visitor: SupabaseClient

  beforeAll(() => {
    visitor = newAnonymousClient(config!)
  })

  it('cannot read Shows, Workspace or locks with the publishable key alone', async () => {
    // The exact request that worked before D-215, and is the whole reason a client-side password
    // would have protected nothing: these two public strings are all an attacker needs.
    const shows = await visitor.from('orion_shows').select('id,public_slug,data')
    const workspace = await visitor.from('orion_workspace').select('id,data')
    const locks = await visitor.from('orion_show_locks').select('show_id')

    expect(shows.error).not.toBeNull()
    expect(shows.data ?? []).toEqual([])
    expect(workspace.error).not.toBeNull()
    expect(workspace.data ?? []).toEqual([])
    expect(locks.error).not.toBeNull()
    expect(locks.data ?? []).toEqual([])
  })

  it('cannot write through the RPCs, which bypass RLS and are gated only by their grant', async () => {
    const saved = await visitor.rpc('orion_save_show', {
      p_id: 'anon-intrusion',
      p_public_slug: 'anon-intrusion-slug',
      p_data: { name: 'Intrusion' },
      p_archived: false,
      p_expected_revision: 0,
      p_client_id: 'anon-intruder',
    })
    const deleted = await visitor.rpc('orion_delete_show', {
      p_id: 'anon-intrusion',
      p_expected_revision: 1,
      p_client_id: 'anon-intruder',
    })
    const workspace = await visitor.rpc('orion_save_workspace', { p_data: {}, p_expected_revision: 0 })
    const lock = await visitor.rpc('orion_acquire_show_lock', {
      p_show_id: 'anon-intrusion',
      p_client_id: 'anon-intruder',
      p_device_label: 'Intruder',
      p_inactive_seconds: 0,
    })

    // Every one of these is `security definer`. A single grant left on `anon` would make the entire
    // access model bypassable while the tables still looked correctly locked down.
    expect(saved.error).not.toBeNull()
    expect(deleted.error).not.toBeNull()
    expect(workspace.error).not.toBeNull()
    expect(lock.error).not.toBeNull()
  })

  it('the member registry is not readable without a session', async () => {
    const { data, error } = await visitor.from('orion_app_users').select('user_id,display_name')

    // The registry carries the identity of everyone with access, so this is the one table whose
    // exposure would be a privacy incident as well as a security one.
    expect(error).not.toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('the administrative member helper is not callable from the application', async () => {
    const { error } = await visitor.rpc('orion_add_member', {
      p_email: 'intruso@ejemplo.com',
      p_display_name: 'Intruso',
      p_role: 'owner',
    })

    // Granting access must require the Supabase dashboard. If this ever succeeds, anyone holding
    // the publishable key can add themselves as a member.
    expect(error).not.toBeNull()
  })

  describe.skipIf(!authenticated)('with the authorised test account', () => {
    let client: SupabaseClient

    beforeAll(async () => {
      client = await newTestClient(config!)
    })

    it('signs in and is recognised as a member', async () => {
      const { data: session } = await client.auth.getSession()
      expect(session.session?.access_token).toBeTruthy()

      const { data, error } = await client.rpc('orion_is_member')

      expect(error).toBeNull()
      // A configured test account that authenticates but is not in orion_app_users would pass every
      // login check and then be denied by every policy — the failure this catches directly.
      expect(data).toBe(true)
    })

    it('can read the member registry it belongs to', async () => {
      const { data, error } = await client.from('orion_app_users').select('user_id,display_name,role')

      expect(error).toBeNull()
      expect((data ?? []).length).toBeGreaterThan(0)
    })

    it('cannot grant membership to anyone else from the application', async () => {
      const { error } = await client.rpc('orion_add_member', {
        p_email: 'intruso@ejemplo.com',
        p_display_name: 'Intruso',
        p_role: 'owner',
      })

      // A compromised session must not be able to hand out access.
      expect(error).not.toBeNull()
    })

    it('cannot insert itself or anyone else into the registry directly', async () => {
      const { data: session } = await client.auth.getSession()
      const { error } = await client.from('orion_app_users').insert({
        user_id: session.session?.user.id,
        display_name: 'Escalada',
        role: 'owner',
      })

      // The registry has a read policy and no write policy, on purpose.
      expect(error).not.toBeNull()
    })
  })
})
