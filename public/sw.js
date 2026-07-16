/* Ori♡n Shows V2 offline shell */
// The client registers this worker as sw.js?v=<package.json version>. The query string makes the
// package version the single release source and gives every release an independent shell cache.
const workerUrl = new URL(self.location.href)
const APP_VERSION = workerUrl.searchParams.get('v') || 'development'
const scopeUrl = new URL(self.registration.scope)
const scopeKey = scopeUrl.pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9_-]+/gi, '-') || 'root'
const CACHE_PREFIX = `orion-shows-${scopeKey}-`
const CACHE_NAME = `${CACHE_PREFIX}v${APP_VERSION}`
const shellUrls = [scopeUrl.href, new URL('index.html', scopeUrl).href, new URL('config.js', scopeUrl).href]

self.addEventListener('install', (event) => {
  // Intentionally does NOT call self.skipWaiting() here. A worker that finishes installing while
  // a previous version still controls open tabs stays in the "waiting" state — see the `message`
  // listener below — so the app can offer a controlled update instead of silently swapping the
  // version underneath an editing user.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(shellUrls)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(new URL('index.html', scopeUrl).href, copy))
          return response
        })
        .catch(async () => (await caches.match(new URL('index.html', scopeUrl).href)) || (await caches.match(scopeUrl.href))),
    )
    return
  }

  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    })),
  )
})
