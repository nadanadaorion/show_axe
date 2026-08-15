import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}))

vi.mock('../../src/lib/config', () => ({
  isRuntimeConfigured: () => true,
  getRuntimeConfig: () => ({
    supabaseUrl: 'https://proyecto.supabase.co',
    supabasePublishableKey: 'sb_publishable_key_visible_a_todos',
  }),
}))

const { cacheAccessToken, fetchPublicShow, releaseRemoteLockKeepalive } = await import('../../src/lib/supabase')

beforeEach(() => {
  vi.clearAllMocks()
  cacheAccessToken(undefined)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

describe('releaseRemoteLockKeepalive', () => {
  /**
   * Regression guard for the exact break D-215 introduces. This request is hand-built because
   * `pagehide` cannot await a session lookup, and it previously sent the publishable key as the
   * bearer — which authenticates as `anon`, a role that no longer holds execute on the RPC. Left
   * unfixed, closing a tab would leave the Show locked for every other device until the lock's
   * ten-minute expiry.
   */
  it('authorises with the session token, not the publishable key', () => {
    cacheAccessToken('session-token-123')

    releaseRemoteLockKeepalive('show-1', 'client-1')

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(url).toBe('https://proyecto.supabase.co/rest/v1/rpc/orion_release_show_lock')
    expect(headers.Authorization).toBe('Bearer session-token-123')
    expect(headers.Authorization).not.toContain('sb_publishable')
    // The publishable key still identifies the project, which is what `apikey` is for.
    expect(headers.apikey).toBe('sb_publishable_key_visible_a_todos')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(String(init.body))).toEqual({ p_show_id: 'show-1', p_client_id: 'client-1' })
  })

  it('sends nothing without a session, rather than a request that is certain to be rejected', () => {
    releaseRemoteLockKeepalive('show-1', 'client-1')

    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('fetchPublicShow', () => {
  const row = {
    id: 'show-1',
    public_slug: 'slug-1',
    data: { name: 'Show público' },
    archived: false,
    revision: 4,
    updated_at: '2026-08-01T00:00:00.000Z',
  }

  /**
   * D-219: the public route must go through the slug-scoped RPC. A `select` over `orion_shows`
   * (what this did before) let anyone holding the publishable key enumerate every Show, archived
   * ones included — the public link restricted nothing at data level.
   */
  it('reads through the slug-scoped RPC', async () => {
    rpc.mockResolvedValue({ data: [row], error: null })

    expect(await fetchPublicShow('slug-1')).toEqual(row)
    expect(rpc).toHaveBeenCalledWith('orion_public_show', { p_slug: 'slug-1' })
  })

  it('accepts a bare row as well as a single-element set', async () => {
    rpc.mockResolvedValue({ data: row, error: null })

    expect(await fetchPublicShow('slug-1')).toEqual(row)
  })

  it('returns null for an unknown slug', async () => {
    rpc.mockResolvedValue({ data: [], error: null })

    expect(await fetchPublicShow('no-existe')).toBeNull()
  })

  it('propagates a rejection so the route can show its own error state', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('permission denied') })

    await expect(fetchPublicShow('slug-1')).rejects.toThrow('permission denied')
  })
})
