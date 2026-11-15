# Catatan — Warung Jajan BHATRA & Dapurin
Diperbarui: 15 Nov 2026

## Sudah jadi
- Brand v1.3: logo, maskot Bhre & Trah, warna, huruf, KV, banner, stiker A4, halaman "Bikin Poster".
- Menu & harga lengkap (31 Okt 2026).
- Carousel komik: 5 cerita × 6 slide + caption.
- Sistem v2 banyak warung (branch `produk`): toko, dashboard, daftar, pusat, produk, legal; 8 tema + desain khusus; backup harian & pantau tiap jam. Lulus uji database & browser. Belum dipasang ke bhatra.id.
- Model jual: langganan Dasar ±49rb / Pro ±99rb per bulan, coba gratis 14 hari, tahunan gratis 2 bulan.

- Maskot diganti karakter Little Bhre (15 Nov 2026): logo A, avatar C, file maskot, KV 01–18 + 19, ikon & logo situs, aplikasi Poster, banner situs. Arsip lama di _lama-datar/. Skrip di _kerja/.
- Situs bhatra.id: gambar diberi nomor versi otomatis (workflow "Kirim situs"), update langsung tampil.
- Strategi konten baru (15 Nov): `strategi-konten.md` + skill `strategi-konten-bhatra`. Antrean lama 16 Nov dibatalkan; antrean Bhatra kosong.
- Script 4 Reels 17–23 Nov: `konten-harian/2026-11-minggu4/script.md`. Video 1 "Kulkas cuma telur satu" jadi (v2: set TK + rig Little Bhre + suara Bhre), menunggu ACC.

## Tugas berikutnya
- [ ] Ganti foto profil IG/TikTok/WA ke avatar baru (brand/logo/png/bhatra-logo-C-avatar-1024px.png).
- [x] Maskot baru live di bhatra.id (img/ via workflow "Kirim gambar maskot", 15 Nov) dan bhatra.id/poster.
- [ ] ACC video 1 → jadwalkan Sen 17 Nov 17:00 (IG + TikTok).
- [ ] Rekam footage HP untuk video 2 "Dengerin dulu" (Rab 19, 11:00) dan video 3 "Uang jajan sisa 20rb" (Jum 21, 17:00) sesuai shot list.
- [ ] Animasi video 4 "Hujan, nggak bisa keluar" (Min 23, 17:00) dengan kerangka reel1b.
- [ ] Hapus branch `banner-baru` di GitHub (tidak bisa dari sesi Claude).
- [ ] Carousel komik "Kenapa namanya BHATRA?" masih maskot lama.
- [ ] Pasang v2 (lihat README, ±20 menit, malam setelah tutup): backup → migrasi 001, 002, 003 → unggah web/ → admin pusat → deploy push → URL & SMTP Supabase → cek.
- [ ] Isi secret GitHub `DB_PASSWORD` & `BACKUP_PASSWORD` untuk backup harian.
- [ ] Fase 0 pilot BHATRA ±1 minggu → lolos jika 7 hari tanpa QRIS/pesanan terlewat.
- [ ] ~~Posting carousel komik tiap 2–3 hari~~ → diganti Reels (strategi 15 Nov).
- [ ] Cari 3–5 warung Kebumen untuk uji (Fase 2).

## Belum diputuskan
1. Nama produk: Dapurin (sementara) / Jajanin / Lapakin / PesanWarung — cek domain .id & Instagram.
2. Model link: `?toko=nama` (sekarang) / `bhatra.id/nama` / `nama.produk.id` — diatur di `web/config.js`.
3. Login: OTP WA (berbayar) atau email (gratis). Sekarang email + password.
4. E-wallet kedua untuk QRIS otomatis setelah DANA.
