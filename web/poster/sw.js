// Poster BHATRA — simpan semua file aplikasi di HP supaya bisa dipakai tanpa sinyal.
// Naikkan VERSI tiap kali ada perubahan supaya HP mengambil versi baru.
const VERSI = 'poster-v1';
const FILES = ['./', 'index.html', 'fonts.css', 'fonts/BricolageGrotesque-800.woff2', 'fonts/PlusJakartaSans.woff2',
  'sample.jpg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('poster-') && k !== VERSI).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Halaman: coba versi terbaru dulu, kalau offline pakai simpanan.
  if (e.request.mode === 'navigate'){
    e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(VERSI).then(c => c.put('index.html', k)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
