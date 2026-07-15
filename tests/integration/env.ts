/**
 * Shared gate for the Supabase-backed integration suite. Every test file
 * imports `getSupabaseTestConfig()` and skips itself (via `describe.skipIf`)
 * when it resolves to `undefined` — never a mock standing in for a real
 * response. See .env.example and docs/19-TESTING_STRATEGY.md for how to
 * point this at a local `supabase start` stack or a disposable test project.
 *
 * When SUPABASE_INTEGRATION_REQUIRED is set (the supabase-integration CI job
 * sets it, after `supabase start`), a missing/unreachable config throws
 * instead of silently skipping — a CI misconfiguration must fail loudly, not
 * report a hollow "success" with every test skipped. This is exactly the
 * regression guard for the bug where the CI step exported an empty
 * SUPABASE_TEST_ANON_KEY and the job still went green.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface TestSupabaseConfig {
  url: string
  anonKey: string
}

function readConfig(): TestSupabaseConfig | undefined {
  const url = process.env.SUPABASE_TEST_URL?.trim()
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY?.trim()
  if (!url || !anonKey) return undefined
  return { url, anonKey }
}

async function isReachable(config: TestSupabaseConfig): Promise<boolean> {
  try {
    const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: config.anonKey },
      signal: AbortSignal.timeout(3_000),
    })
    // PostgREST answers even for an unauthorized/malformed request; only a
    // network failure (caught below) or a 5xx means "not really there".
    return response.status < 500
  } catch {
    return false
  }
}

let cached: Promise<TestSupabaseConfig | undefined> | undefined

function required(): boolean {
  return Boolean(process.env.SUPABASE_INTEGRATION_REQUIRED)
}

/** Resolves to the test config only if it is both set and actually reachable right now. */
export function getSupabaseTestConfig(): Promise<TestSupabaseConfig | undefined> {
  if (!cached) {
    cached = (async () => {
      const config = readConfig()
      if (!config) {
        const message =
          '[integration] SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY are not set. See .env.example. ' +
          "Run `supabase start` and export the printed values, or point at a disposable test project."
        if (required()) throw new Error(message)
        console.warn(`[integration] SKIP: ${message}`)
        return undefined
      }
      if (!(await isReachable(config))) {
        const message = `${config.url} is not reachable. Is 'supabase start' running?`
        if (required()) throw new Error(`[integration] ${message}`)
        console.warn(`[integration] SKIP: ${message}`)
        return undefined
      }
      return config
    })()
  }
  return cached
}

export function newTestClient(config: TestSupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
