import { describe, expect, it } from 'vitest'
import { isSupportedSupabaseUrl } from '../../src/lib/config'

describe('isSupportedSupabaseUrl', () => {
  it('accepts a production Supabase project URL', () => {
    expect(isSupportedSupabaseUrl('https://abcdefgh.supabase.co')).toBe(true)
    expect(isSupportedSupabaseUrl('https://abcdefgh.supabase.co/')).toBe(true)
  })

  it('accepts the local supabase start stack used by the documented dev/test workflow', () => {
    // docs/19-TESTING_STRATEGY.md documents `supabase start` + SUPABASE_TEST_URL against this
    // exact local address; isRuntimeConfigured() must not reject it, or the Setup screen would
    // never be satisfied and the app would never leave it — which is exactly the bug that made
    // every Supabase-backed E2E spec time out waiting for post-setup UI that never rendered.
    expect(isSupportedSupabaseUrl('http://127.0.0.1:54321')).toBe(true)
    expect(isSupportedSupabaseUrl('http://localhost:54321')).toBe(true)
  })

  it('rejects an invalid or unsupported URL', () => {
    expect(isSupportedSupabaseUrl('not-a-url')).toBe(false)
    expect(isSupportedSupabaseUrl('http://example.com')).toBe(false)
    expect(isSupportedSupabaseUrl('https://supabase.co.evil.example')).toBe(false)
    expect(isSupportedSupabaseUrl('')).toBe(false)
  })
})
