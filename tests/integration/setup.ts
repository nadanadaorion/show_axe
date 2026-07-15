import { getSupabaseTestConfig } from './env'

// Resolve once up front so the skip/reachability message appears exactly
// once per run, before any test file's own describe.skipIf evaluates it.
await getSupabaseTestConfig()
