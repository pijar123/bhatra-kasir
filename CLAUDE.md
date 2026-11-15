# CLAUDE.md — bhatra-kasir (Dapurin, nama sementara)

Sistem pesan online untuk banyak warung. Toko pertama: Warung Jajan BHATRA (bhatra.id).
Status dan tugas terkini ada di `CATATAN.md`. Cara pasang ada di `README.md`.

## Cara kerja
- Bahasa Indonesia santai, jawaban singkat, proses hemat.
- Branch kerja: `produk` (v2 banyak warung). `main` = versi berjalan + GitHub Actions (backup, pantau).
- Jangan ubah produksi (bhatra.id di Hostinger, Supabase `wtmzvxmghlwukjwfvpmp`) tanpa persetujuan pemilik. Perubahan database hanya lewat file migrasi baru.
- Jangan commit rahasia (password DB, BACKUP_PASSWORD, service key). `SUPABASE_ANON_KEY` di `config.js` memang publik.

## Struktur
- `web/` — situs (unggah ke `public_html`). Semua pengaturan produk (nama, harga, domain, mode link, WA support) di `web/config.js`. Tema di `web/themes.js`.
  - `index.html` toko pembeli · `owner/` dashboard pemilik · `daftar/` daftar toko · `pusat/` admin pusat · `produk/` halaman jualan · `legal/` syarat & privasi
- `supabase/migrations/` — `001_banyak_warung`, `002_tampilan`, `003_pantau`. Harus aman dijalankan ulang (idempotent). Migrasi baru = nomor berikutnya, jangan ubah yang lama setelah dipasang.
- `supabase/functions/push/` — web push per toko.
- `v1/` — salinan situs lama untuk cadangan. Jangan diubah.
- `e2e/` — uji browser.

## Aturan data
- Tiap warung hanya melihat datanya sendiri (RLS). Pemilik tidak bisa mengubah paket/desain khusus miliknya — itu wewenang admin pusat.
- Data BHATRA harus tetap utuh; aplikasi BHATRA Kasir (Android) tidak boleh rusak.
- Fitur Pro dikunci di sisi database, bukan hanya di tampilan.
- Langganan dibayar di luar aplikasi Android (hindari Play Billing).

## Uji (wajib lulus sebelum commit)
- Database: `supabase/tests/jalankan.sh` (uji isolasi antar toko).
- Browser: `e2e/jalankan.sh` (Postgres lokal port 5433 + PostgREST + server uji).
- Ubah tampilan → lihat hasil render (screenshot), jangan cuma baca kode.

## Brand BHATRA (untuk tema default)
- Warna: Sambal #C8372D · Kunyit #F2B33D · Kecap #3A1E12 · Santan #FFF4E2
- Huruf: Bricolage Grotesque ExtraBold (judul/harga) · Plus Jakarta Sans (teks)
- Jam 10.00–22.00 WIB, antar & COD s.d. 20.00, ongkir Rp1.000/km.
