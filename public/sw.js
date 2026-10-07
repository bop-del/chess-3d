// Web push for online play (CHE-272): push and notificationclick only. No cache, no fetch handler (an offline cache is its own item).
// The payload is JSON: { kind, title, body, tag, url, data }. One notification per tag replaces the older one, renotify off.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
