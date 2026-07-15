/**
 * Shared gate for the Supabase-backed integration suite. Every test file
 * imports `getSupabaseTestConfig()` and skips itself (via `describe.skipIf`)
 * when it resolves to `undefined` — never a mock standing in for a real
 * response. See .env.example and docs/19-TESTING_STRATEGY.md for how to
 * point this at a local `supabase start` stack or a disposable test project.
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

/** Resolves to the test config only if it is both set and actually reachable right now. */
export function getSupabaseTestConfig(): Promise<TestSupabaseConfig | undefined> {
  if (!cached) {
    cached = (async () => {
      const config = readConfig()
      if (!config) {
        console.warn(
          '[integration] SKIP: SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY are not set. See .env.example. ' +
            'Run `supabase start` and export the printed values, or point at a disposable test project.',
        )
        return undefined
      }
      if (!(await isReachable(config))) {
        console.warn(`[integration] SKIP: ${config.url} is not reachable. Is 'supabase start' running?`)
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
