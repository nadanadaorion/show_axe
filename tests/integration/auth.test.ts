/**
 * Real Supabase integration tests for the authorisation foundation (D-215/D-216).
 *
 * These assert what phase 1 of the migration establishes. The assertions that anonymous clients are
 * refused reads and writes on `orion_shows`/`orion_workspace` belong to the revocation migration and
 * are added with it — asserting them now would fail against a project that is still deliberately
 * open, which would say nothing about the code.
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

  it('the member registry is not readable without a session', async () => {
    const { data, error } = await visitor.from('orion_app_users').select('user_id')

    // Anonymous holds no privilege on this table, so PostgREST either errors or — depending on how
    // it reports a missing grant — returns nothing. What must never happen is member data coming
    // back: the registry carries the e-mail addresses of everyone with access.
    expect(error ?? data).not.toBeNull()
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
