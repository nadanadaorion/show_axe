import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'public/config.js'), 'utf-8')

function runConfigScript(existing?: Record<string, string>) {
  const fakeWindow: { __ORION_CONFIG__?: Record<string, string> } = existing ? { __ORION_CONFIG__: existing } : {}
  const run = new Function('window', source)
  run(fakeWindow)
  return fakeWindow.__ORION_CONFIG__
}

describe('public/config.js', () => {
  it('ships empty placeholders when nothing has configured window.__ORION_CONFIG__ yet', () => {
    expect(runConfigScript()).toEqual({ supabaseUrl: '', supabasePublishableKey: '' })
  })

  it('does not clobber a config already injected before this script runs', () => {
    // Regression test: Playwright's addInitScript (tests/e2e/supabaseTestConfig.ts) sets
    // window.__ORION_CONFIG__ before any page script runs, including this one — a flat assignment
    // here unconditionally overwrote it with empty strings, silently stranding every
    // Supabase-backed E2E spec on the Setup screen (getByRole('button', { name: 'Nuevo show' })
    // never appeared, because the app never left the unconfigured state).
    const injected = { supabaseUrl: 'http://127.0.0.1:54321', supabasePublishableKey: 'sb_publishable_test' }
    expect(runConfigScript(injected)).toEqual(injected)
  })
})
