// Service worker (CHE-272 push, CHE-304 offline cache).
// Cache: install stores the built game (app shell, hashed assets, tiles) under a name with the build id. The build step (vite.config.js,
// plugin swPrecache) fills BUILD and PRECACHE below; in dev they keep the placeholders, so nothing is precached (the page registers
// this worker only in a release build or with ?sw=1). Navigations go network first (a new release is seen at once online) and fall back
// to the cached page offline; every other same origin GET is cache first, then the network (and then stored). Online play talks to
// another origin and push to its own routes: neither passes through here.
// Update: a new worker waits (no skipWaiting on its own, so a running game never loses its lazy chunks). The page shows "New version,
// reload"; a tap sends {type:'skip-waiting'}, the worker activates, the page reloads. Without a tap the new worker activates when the
// last tab closes, so the next open loads the new version. Old caches go on activate.
// Push: JSON payload { kind, title, body, tag, url, data }. One notification per tag replaces the older one, renotify off.
const BUILD = 'dev'; /* BUILD */
const PRECACHE = [/* PRECACHE */];
const CACHE = 'chess3d-' + BUILD;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    if (!PRECACHE.length) return;
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
  })());
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('chess3d-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !PRECACHE.length) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match(new URL('./', self.registration.scope).href)) || Response.error()));
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
    return res;
  })());
});

self.addEventListener('push', (e) => {
  let p = null;
  try { p = e.data ? e.data.json() : null; } catch (err) { p = null; }
  if (!p || !p.title) return;
  e.waitUntil(self.registration.showNotification(p.title, { body: p.body || '', tag: p.tag || p.kind || 'chess', renotify: false, icon: 'icon-192.png', data: { url: p.url || '?open=online' } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '?open=online', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = wins.find((c) => new URL(c.url).origin === self.location.origin);
    if (mine) { try { await mine.focus(); return await mine.navigate(target); } catch (err) { /* fall through to a new window */ } }
    return self.clients.openWindow(target);
  })());
});
