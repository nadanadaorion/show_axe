import { defineConfig } from 'vitest/config'

// Separate from vitest.config.ts on purpose: these tests talk to a real
// Supabase instance (local CLI stack or a disposable test project) and must
// never run as part of the default `npm run test` unit/component suite.
// They self-skip with a clear message when SUPABASE_TEST_URL is unset or
// unreachable — see tests/integration/setup.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['./tests/integration/setup.ts'],
    hookTimeout: 20_000,
    testTimeout: 20_000,
    css: false,
  },
})
