const CACHE = 'platform-v1';
const SHELL = ['./', 'index.html', 'app.css', 'shop.js', 'qris.js', 'config.js', 'install.js', 'platform.css', 'img/icon.svg', 'img/icon-192.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Selalu ambil versi terbaru dari internet; pakai cache hanya saat offline.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});

// Notifikasi pesanan baru untuk owner.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'BHATRA', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Pesanan baru', { body: d.body || '', icon: '/img/icon-owner-192.png', badge: '/img/icon-owner-192.png', tag: d.title || 'bhatra', renotify: true, requireInteraction: true, silent: false, vibrate: [300, 100, 300, 100, 300], data: { url: d.url || '/owner/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/owner/', self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { const w = ws.find(x => x.url.startsWith(url)); return w ? w.focus() : clients.openWindow(url); }));
});
