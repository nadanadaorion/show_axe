import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Some sandboxed dev environments ship a pre-installed Chromium outside Playwright's own
// managed cache. Prefer it when present instead of requiring `playwright install`; elsewhere
// (CI, regular developer machines) fall back to Playwright's normal browser resolution.
const preinstalledChromium = '/opt/pw-browsers/chromium'
const chromiumExecutablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined
const usesSharedSupabase = Boolean(process.env.SUPABASE_TEST_URL?.trim())

export default defineConfig({
  testDir: './tests/e2e',
  // The E2E environment has one shared Workspace row and broadcasts every Show change through
  // Realtime. Running stateful specs concurrently makes one browser's remote writes re-render
  // another browser mid-interaction and lets Workspace scenarios mutate the same singleton. Keep
  // deterministic, isolated execution whenever a real Supabase target is configured; the always-on
  // setup/layout checks remain parallel when no shared backend is present.
  fullyParallel: !usesSharedSupabase,
  workers: usesSharedSupabase ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  // Milestone 3 acceptance requires every scenario to pass on its first attempt.
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/*.mobile.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    {
      name: 'mobile',
      testMatch: '**/*.mobile.spec.ts',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
