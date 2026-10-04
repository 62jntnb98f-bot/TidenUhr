const CACHE = 'tiden-v46-14-2026';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './data/stations.json',
  './data/DE__510P2026.json',
  './data/DE__632P2026.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req, {cache:'no-store'})
        .then(response => {
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  const url=new URL(req.url);
  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy));
          return response;
        })
      )
    );
  }
});
