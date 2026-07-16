import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

export default defineConfig({
  testDir: './tests/pages',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run build:pages && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort --base=/show_axe/`,
    url: `http://127.0.0.1:${PORT}/show_axe/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
