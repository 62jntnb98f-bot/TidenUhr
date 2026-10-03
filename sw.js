const CACHE='tiden-v45.2-2026';
const ASSETS=['./','./index.html','./manifest.webmanifest','./data/stations.json','./data/DE__510P2026.json','./data/DE__632P2026.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tiden-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin===location.origin && (e.request.mode==='navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/sw.js'))){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));}return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request).then(r=>{if(url.origin===location.origin&&r.ok){caches.open(CACHE).then(c=>c.put(e.request,r.clone()));}return r;}).catch(()=>caches.match('./index.html'))));
});
