const cacheName = 'swpt-debtors-ui-v1';
const appFiles = [
  './',
  'index.html',
  'manifest.json',
  'favicon.png',
  'global.css',
  'config.js',
  'build/bundle.css',
  'build/bundle.js',
]
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install')
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    console.log('[Service Worker] Caching app files')
    await cache.addAll(appFiles)
  })())
})
self.addEventListener('fetch', (e) => {
  e.respondWith((async () => {
    const r = await caches.match(e.request, {ignoreSearch: true})
    if (r) { return r }
    return await fetch(e.request)
  })())
})
