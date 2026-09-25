/* GIRI Go service worker – app shell offline, libraries cached, data always live.
   No version bump needed per release: index.html is always fetched network-first, the cache is only the offline fallback. */
const CACHE = 'giri-go-shell';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if(e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === location.origin){
    // app shell: network first and always revalidated (no-cache → GitHub Pages' 10-minute HTTP cache is skipped), cache as offline fallback
    if(req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')){
      e.respondWith(fetch(req.url, {cache:'no-cache', credentials:'same-origin'}).then(r => { if(r.ok){ const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); } return r; }).catch(() => caches.match('./index.html'))); return; }
    // built app files (assets/index-<hash>.js|css, fonts, vendor): the hash changes with every release, so cache first is safe –
    // no round trip to GitHub Pages on every start. Old builds are dropped from the cache when a new one arrives.
    if(/\/(assets|fonts|vendor)\//.test(url.pathname)){
      e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if(res.ok){ const c = res.clone(); caches.open(CACHE).then(async x => { await x.put(req, c); if(url.pathname.includes('/assets/')){ const ext = url.pathname.split('.').pop(); const keys = await x.keys(); keys.forEach(k => { const u = new URL(k.url); if(u.pathname.includes('/assets/') && u.pathname.endsWith('.'+ext) && u.pathname !== url.pathname) x.delete(k); }); } }); } return res; }))); return; }
    // icons, manifest, login image: network first (so a new login.jpg shows up), cache fallback
    e.respondWith(fetch(req).then(res => { if(res.ok){ const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; }).catch(() => caches.match(req))); return;
  }
  // libraries + fonts from CDNs (versioned URLs): cache first
  if(/cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host)){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if(res.ok || res.type === 'opaque'){ const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; }))); return;
  }
  // Supabase, DeepL etc.: network only
});
