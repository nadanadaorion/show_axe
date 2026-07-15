// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

type WorkerHandler = (event: { data?: unknown; request?: Request; waitUntil?: (work: Promise<unknown>) => void }) => void

function loadWorker() {
  const handlers = new Map<string, WorkerHandler>()
  const openedCaches: string[] = []
  const deletedCaches: string[] = []
  const addAll = vi.fn().mockResolvedValue(undefined)
  const skipWaiting = vi.fn()
  const claim = vi.fn().mockResolvedValue(undefined)
  const caches = {
    open: vi.fn(async (name: string) => {
      openedCaches.push(name)
      return { addAll, put: vi.fn() }
    }),
    keys: vi.fn(async () => ['orion-shows-v2.0.0', 'orion-shows-v2.0.0-m3.1', 'another-app-cache']),
    delete: vi.fn(async (name: string) => {
      deletedCaches.push(name)
      return true
    }),
    match: vi.fn(),
  }
  const self = {
    registration: { scope: 'https://example.test/show_axe/' },
    location: { origin: 'https://example.test' },
    clients: { claim },
    skipWaiting,
    addEventListener: (type: string, handler: WorkerHandler) => handlers.set(type, handler),
  }
  const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, { self, caches, URL, Promise })
  return { handlers, openedCaches, deletedCaches, addAll, skipWaiting, claim }
}

async function dispatchExtendable(handler: WorkerHandler) {
  let work: Promise<unknown> | undefined
  handler({ waitUntil: (promise) => { work = promise } })
  await work
}

describe('Service Worker offline cache lifecycle', () => {
  it('installs into a new independent versioned cache without activating automatically', async () => {
    const worker = loadWorker()
    await dispatchExtendable(worker.handlers.get('install')!)

    expect(worker.openedCaches).toEqual(['orion-shows-v2.0.0-m3.1'])
    expect(worker.addAll).toHaveBeenCalledOnce()
    expect(worker.skipWaiting).not.toHaveBeenCalled()
  })

  it('deletes only older Ori♡n caches and preserves the current and unrelated caches', async () => {
    const worker = loadWorker()
    await dispatchExtendable(worker.handlers.get('activate')!)

    expect(worker.deletedCaches).toEqual(['orion-shows-v2.0.0'])
    expect(worker.deletedCaches).not.toContain('orion-shows-v2.0.0-m3.1')
    expect(worker.deletedCaches).not.toContain('another-app-cache')
    expect(worker.claim).toHaveBeenCalledOnce()
  })

  it('activates only after the explicit SKIP_WAITING message', () => {
    const worker = loadWorker()
    worker.handlers.get('message')!({ data: { type: 'IGNORED' } })
    expect(worker.skipWaiting).not.toHaveBeenCalled()
    worker.handlers.get('message')!({ data: { type: 'SKIP_WAITING' } })
    expect(worker.skipWaiting).toHaveBeenCalledOnce()
  })
})
