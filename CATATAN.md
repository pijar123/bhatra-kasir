# Catatan — Warung Jajan BHATRA & Dapurin
Diperbarui: 15 Nov 2026

## Sudah jadi
- Brand v1.3: logo, maskot Bhre & Trah, warna, huruf, KV, banner, stiker A4, halaman "Bikin Poster".
- Menu & harga lengkap (31 Okt 2026).
- Carousel komik: 5 cerita × 6 slide + caption.
- Sistem v2 banyak warung (branch `produk`): toko, dashboard, daftar, pusat, produk, legal; 8 tema + desain khusus; backup harian & pantau tiap jam. Lulus uji database & browser. Belum dipasang ke bhatra.id.
- Model jual: langganan Dasar ±49rb / Pro ±99rb per bulan, coba gratis 14 hari, tahunan gratis 2 bulan.

- Maskot diganti karakter Little Bhre (15 Nov 2026, disetujui istri): logo, avatar, ikon aplikasi (web/img), aplikasi Poster (main, poster-v2). Aset desain di Mac ~/MABES/bhatra.

## Tugas berikutnya
- [ ] Ganti foto profil IG/TikTok/WA ke avatar baru.
- [ ] Situs yang sedang jalan (v1) masih maskot lama sampai v2 dipasang, atau unggah web/img baru ke public_html/img lewat hPanel.
- [ ] Carousel komik "Kenapa namanya BHATRA?" masih maskot lama.
- [ ] Pasang v2 (lihat README, ±20 menit, malam setelah tutup): backup → migrasi 001, 002, 003 → unggah web/ → admin pusat → deploy push → URL & SMTP Supabase → cek.
- [ ] Isi secret GitHub `DB_PASSWORD` & `BACKUP_PASSWORD` untuk backup harian.
- [ ] Fase 0 pilot BHATRA ±1 minggu → lolos jika 7 hari tanpa QRIS/pesanan terlewat.
- [ ] Posting carousel komik 1 tiap 2–3 hari (cerita 4 pas hujan).
- [ ] Cari 3–5 warung Kebumen untuk uji (Fase 2).

## Belum diputuskan
1. Nama produk: Dapurin (sementara) / Jajanin / Lapakin / PesanWarung — cek domain .id & Instagram.
2. Model link: `?toko=nama` (sekarang) / `bhatra.id/nama` / `nama.produk.id` — diatur di `web/config.js`.
3. Login: OTP WA (berbayar) atau email (gratis). Sekarang email + password.
4. E-wallet kedua untuk QRIS otomatis setelah DANA.
