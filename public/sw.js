const CACHE_VERSION = 'clareza-static-v1'
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/pwa-icon-192.png', '/pwa-icon-512.png', '/pwa-icon-maskable-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('clareza-') && key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/image')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  const isStaticAsset = url.pathname.startsWith('/_next/static/') || PRECACHE.includes(url.pathname)
  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()))
      return response
    })),
  )
})
