# AI.md — Panduan untuk AI di proyek Warung Jajan BHATRA

Baca ini dulu sebelum mengerjakan apa pun di proyek ini.

## Cara kerja
- Bahasa: Indonesia santai, jawaban singkat. Proses hemat & efisien — jangan bertele-tele.
- Sebelum menjawab soal brand/menu/harga/rencana, baca dokumen sumbernya. Jangan mengarang dari ingatan.
- Tidak boleh mengarang testimoni, angka penjualan, ulasan, atau klaim. Tokoh di konten = ilustrasi.
- Kalau info di dokumen saling bertentangan, tanya dulu, jangan menebak.
- Setelah ada keputusan baru, perbarui dokumen terkait (dan catatan.md).

## Sumber kebenaran (urutan prioritas)
1. `menu-bhatra.md` — harga, menu, lokasi, WA, tagline
2. `brand-bhatra.md` — warna, huruf, maskot, logo, jam, ongkir, aturan desain
3. `rencana-jual.md` — produk sistem pesan untuk warung lain
4. `carousel-komik.md` — konten carousel & caption
5. `catatan.md` — status terkini & daftar tugas
6. `strategi-konten.md` — rumus cerita, format Reels, bahasa kamera, caption, evaluasi
(1–4 ada di proyek Claude "Warung Jajan Bhatra"; harga juga terbaca di poster menu `kv/05`. 5–6 ada di folder ini.)

## Fakta inti (cek ulang ke dokumen sumber kalau ragu)
- Jam buka 10.00–22.00 WIB. Antar & COD s.d. 20.00, setelahnya ambil di rumah s.d. 22.00.
- Ongkir Rp1.000/km. WA 0813-9112-5240. Maps: "RUMAH BHRE", Karangtempel, Demangsari, Ayah, Kebumen.
- Target: ibu-ibu & anak SMA. Slogan: "Kenyang mulai 16 ribu".
- Warna: Sambal #C8372D · Kunyit #F2B33D · Kecap #3A1E12 · Santan #FFF4E2.
- Huruf: Bricolage Grotesque ExtraBold (judul/harga) · Plus Jakarta Sans (teks).

## Aturan desain (wajib)
- Gaya vektor datar, palet terbatas, tanpa gradasi/efek.
- Kalau ada Bhre, Trah ikut (permintaan istri).
- Maskot = karakter Little Bhre (sejak 15 Nov 2026, disetujui istri): garis tinta tebal, kulit sawo matang. Pakai file di brand/maskot/ atau buat pose baru dari rig Little Bhre. Maskot datar lama jangan dipakai lagi (arsip di _lama-datar/).
- SELALU render & lihat hasilnya sebelum bilang selesai. Cek: jarak aman ≥4% dari tepi, maskot tidak kepotong (rambut Bhre sisi kanan), tidak ada ruang kosong besar, teks stiker ≥8 pt / ceklis ≥9 pt. Perbaiki → render ulang → cek lagi.

## Konten media sosial (diperbarui 15 Nov 2026)
- Baca `strategi-konten.md` dulu. Skill akun: `strategi-konten-bhatra`.
- Format utama **Reels** (data 18 Okt–14 Nov: 32 foto/carousel, views 3–58, 0 komentar). 1 Reel/hari selang-seling: kartun Bhre & Trah (ibu-ibu), makanan asli rekam HP (semua), POV teks + footage (anak SMA). Jam awal 11:00 & 17:00.
- Rumus cerita: satu momen nyata → taruhan → satu emosi → produk datang belakangan (1 menu + harga) → punchline → pertanyaan komentar.
- Script wajib pakai tabel: Detik | Ukuran | Sudut | Gerak/transisi | Visual | Teks | Suara + cek liputan (bahasa kamera dari Little Bhre `docs/camera-language.md`).
- Overlay tetap `WA 0813-9112-5240 · bhatra.id`, label "Ilustrasi" di kartun. Trah bayi tidak makan ayam/sambal (pegang biskuit/botol).
- Selalu cantumkan WA + jam antar/ambil yang benar. Hashtag: #KulinerKebumen #Kebumen #BHATRA + menu.
- Script & hasil per minggu: `konten-harian/YYYY-MM-mingguN/` (`script.md`, `vN_tglbln_judul.mp4`, `cover_*.jpg`).

## Produksi video kartun
- Kerangka: `_kerja/skrip/reel1b/` (contoh: video 1 "Kulkas cuma telur satu").
  - Set, properti, kamera, iris dua dunia, kartu HP, efek: `ep.js` + `hidup.js` dari repo `tk-penginapan-konten` (draf 14 Nov).
  - Tokoh Bhre & Trah + akting: rig Little Bhre (`little-bhre/kit`: life, hands, trah), dikirim per frame lewat `window.CH`.
  - Suara: kit audio Little Bhre. Suara Bhre hanya klip yang sudah disetujui (`assets/audio/vox/bhre_*` + `bhre_laugh_*`), satu klip per momen, jangan berulang. Trah belum punya suara.
  - Jalankan: `python3 reel1b.py check` (lembar cek) → `python3 reel1b.py full` (mp4 30 fps, -14 LUFS).
- Penilaian dari lembar frame + angka loudness; pemilik menonton untuk rasa gerak dan suara. Jadwal hanya setelah ACC pemilik.

## Teknis
- Folder ini: `~/MABES/bhatra` (brand/, kv/, carousel-komik/, konten-harian/, dashboard/).
- Kode sistem pesan: GitHub `pijar123/bhatra-kasir`, branch `produk` (ada CLAUDE.md & README).
- Jangan ubah data/kode produksi (bhatra.id, Supabase) tanpa persetujuan pemilik.
- Situs live: ubah lewat folder `situs/` di branch `main` → workflow "Kirim situs" (FTP, cadangan otomatis, gambar diberi `?v=` supaya HP langsung ambil versi baru).
- Banner promo situs ada di Supabase (`settings.banners` + storage `banner`), diganti dari halaman admin (login pemilik).
- Posting terjadwal: Postingkuy brand `bhatra` (IG + TikTok).
- Salinan AI.md, catatan.md, strategi-konten.md juga ada di repo `bhatra-kasir` folder `bhatra-brand/` (branch `produk`).
