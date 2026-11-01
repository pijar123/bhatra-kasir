// Pengaturan platform. Ganti BRAND dan ROOT setelah nama produk diputuskan.
window.CONFIG = {
  BRAND: 'Dapurin',                       // nama produk (sementara)
  ROOT: 'dapurin.id',                     // domain utama; toko = <slug>.dapurin.id
  SUPABASE_URL: 'https://PROYEK-BARU.supabase.co',
  SUPABASE_ANON_KEY: 'ISI_PUBLISHABLE_KEY',
  ADMIN_WA: '6281391125240',              // nomor WA untuk bayar langganan & bantuan
  PRICE: { dasar: 49000, pro: 99000 },
  APK: 'https://github.com/pijar123/bhatra-kasir/releases/latest/download/bhatra-kasir.apk'
};
// Alamat toko: subdomain <slug>.ROOT, atau ?toko=<slug> (untuk uji coba sebelum subdomain aktif)
window.shopSlug = () => {
  const q = new URLSearchParams(location.search).get('toko');
  if (q) return q.toLowerCase();
  const h = location.hostname, r = CONFIG.ROOT;
  return h.endsWith('.' + r) && h !== 'www.' + r ? h.slice(0, -r.length - 1) : '';
};
window.shopUrl = slug => location.hostname.endsWith(CONFIG.ROOT) ? `https://${slug}.${CONFIG.ROOT}` : `${location.origin}/?toko=${slug}`;
