import { readFile, writeFile } from 'node:fs/promises'

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim()

if (!/^https:\/\/.+\.supabase\.co$/i.test(url)) throw new Error('SUPABASE_URL must be a Supabase project URL')
if (key.length < 20 || /service[_-]?role|sb_secret_/i.test(key)) throw new Error('SUPABASE_PUBLISHABLE_KEY must be a publishable/anon key, never a secret key')

const target = new URL('../dist/config.js', import.meta.url)
await readFile(target, 'utf8')
await writeFile(target, `// Generated at deploy time from public GitHub Actions variables.\nwindow.__ORION_CONFIG__ = {\n  supabaseUrl: ${JSON.stringify(url)},\n  supabasePublishableKey: ${JSON.stringify(key)},\n}\n`)
