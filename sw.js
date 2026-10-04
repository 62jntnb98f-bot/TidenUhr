const CACHE='tiden-v46.7-2026';

const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './data/stations.json',
  './data/DE__510P2026.json',
  './data/DE__632P2026.json'
];

self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith('tiden-') && key!==CACHE)
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message', event=>{
  if(event.data && event.data.type==='SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event=>{
  if(event.request.method!=='GET') return;

  const url=new URL(event.request.url);

  // HTML navigation and the service worker itself are always fetched fresh.
  // This prevents an old GitHub Pages index.html from being served from cache.
  if(
    url.origin===location.origin &&
    (
      event.request.mode==='navigate' ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/sw.js')
    )
  ){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>response)
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // Other local assets may use the cache and fall back to the network.
  event.respondWith(
    caches.match(event.request)
      .then(cached=>{
        if(cached) return cached;

        return fetch(event.request).then(response=>{
          if(
            url.origin===location.origin &&
            response.ok
          ){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          }
          return response;
        });
      })
      .catch(()=>caches.match('./index.html'))
  );
});
