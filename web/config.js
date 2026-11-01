// Konfigurasi produk. Satu file ini yang diubah saat nama/domain produk diputuskan.
window.CONFIG = {
  SUPABASE_URL: 'https://wtmzvxmghlwukjwfvpmp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_HnF1K96NVO6zV6SiKpy7qw_8lu9rRfL',
  PRODUCT: 'Dapurin',                 // nama produk (sementara, belum diputuskan)
  OWNER_APP: 'Dapurin Owner',         // nama aplikasi dashboard di HP
  KASIR_APP: 'BHATRA Kasir',          // nama aplikasi Android saat ini
  APK: 'https://github.com/pijar123/bhatra-kasir/releases/latest/download/bhatra-kasir.apk',
  ROOT_DOMAIN: 'bhatra.id',           // domain tempat produk dipasang
  SUBDOMAINS: false,                  // true kalau *.ROOT_DOMAIN sudah diarahkan ke hosting
  PRETTY_PATHS: false,                // true kalau .htaccess rewrite sudah terbukti jalan (link /namatoko)
  SUPPORT_WA: '6281391125240',        // WA pemilik produk: bantuan & bayar langganan
  PRICES: { dasar: 49000, pro: 99000 },
  TRIAL_DAYS: 14
};
// Link toko sesuai cara pemasangan yang aktif.
window.shopLink = s => s.custom_domain ? `https://${s.custom_domain}`
  : CONFIG.SUBDOMAINS ? `https://${s.slug}.${CONFIG.ROOT_DOMAIN}`
  : CONFIG.PRETTY_PATHS ? `https://${CONFIG.ROOT_DOMAIN}/${s.slug}`
  : `https://${CONFIG.ROOT_DOMAIN}/?toko=${s.slug}`;
