/* TidenUhr Service Worker v46.67
   Navigation: network-first; cache is only the offline fallback.
   LocalStorage (BSH imports and favorites) is not touched by this worker. */
const CACHE = 'tiden-v46-67-2026';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './data/stations.json',
  './data/DE__510P2026.json',
  './data/DE__632P2026.json',
  './KIEL-HOLTENAU2026.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache available shell assets, but do not let a missing optional asset block installation.
    await Promise.all(ASSETS.map(async asset => {
      try {
        const response = await fetch(new Request(asset, { cache: 'reload' }));
        if (response.ok) await cache.put(new Request(asset), response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('tiden-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          // Cache the current page for offline use, but always return the network response first.
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // For same-origin assets, prefer cached files and fetch uncached files normally.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    return fetch(request);
  })());
});
