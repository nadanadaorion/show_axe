import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Some sandboxed dev environments ship a pre-installed Chromium outside Playwright's own
// managed cache. Prefer it when present instead of requiring `playwright install`; elsewhere
// (CI, regular developer machines) fall back to Playwright's normal browser resolution.
const preinstalledChromium = '/opt/pw-browsers/chromium'
const chromiumExecutablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
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
