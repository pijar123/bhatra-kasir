# Dapurin (nama sementara): toko online untuk banyak warung

Versi 2 dari sistem bhatra.id. Satu database dan satu situs melayani banyak warung, dan BHATRA menjadi toko pertama.

```
web/                 situs (unggah ke public_html Hostinger)
  index.html         halaman toko untuk pembeli (?toko=slug, subdomain, /slug, atau domain sendiri)
  owner/             dashboard pemilik warung
  daftar/            pendaftaran toko baru (masa coba 14 hari)
  pusat/             admin pusat: semua toko, perpanjang paket, bekukan
  produk/            halaman jualan
  legal/             syarat layanan dan kebijakan privasi
  config.js          SEMUA pengaturan produk: nama, harga, WA support, mode link
supabase/
  migrations/001_banyak_warung.sql   migrasi v1 ke v2 (aman dijalankan ulang)
  functions/push/index.ts            notifikasi web push per toko
  tests/jalankan.sh                  uji database lokal (33 uji isolasi antar toko)
v1/                  salinan situs bhatra.id saat ini, untuk cadangan
```

## Pindah dari v1 ke v2 (sekali, sekitar 20 menit)

Lakukan saat warung sepi, misalnya malam setelah tutup. Halaman lama tidak cocok dengan database baru, jadi langkah 2 dan 3 harus berdekatan.

1. **Cadangan.** Di Supabase pilih Database lalu Backups. Di Hostinger, unduh isi `public_html`.
2. **Migrasi database.** Di Supabase buka SQL Editor, tempel seluruh isi `supabase/migrations/001_banyak_warung.sql`, lalu Run. Ulangi untuk `002_tampilan.sql` dan `003_pantau.sql`. Hasil yang diharapkan: "Success. No rows returned".
3. **Unggah situs.** Ganti isi `public_html` dengan isi folder `web/`, termasuk `.htaccess`.
4. **Admin pusat.** Di SQL Editor jalankan:
   ```sql
   insert into platform_admins (user_id)
   select id from auth.users where email = 'EMAIL-ANDA@gmail.com';
   ```
5. **Fungsi push.** Di Supabase pilih Edge Functions, buka `push`, ganti kodenya dengan `supabase/functions/push/index.ts`, lalu Deploy.
6. **Pengaturan login** di Authentication:
   - URL Configuration: Site URL `https://bhatra.id`, lalu tambahkan Redirect URLs `https://bhatra.id/daftar/*` dan `https://bhatra.id/owner/*`.
   - Email: jatah email bawaan Supabase hanya beberapa per jam. Sebelum promosi, pasang SMTP sendiri di Authentication, Emails, SMTP Settings. Contoh: Brevo gratis 300 email/hari, atau email Hostinger.
   - Email templates (opsional): ubah ke bahasa Indonesia.
7. **Cek**:
   - `bhatra.id` menampilkan menu BHATRA seperti biasa.
   - Pesan tes masuk ke dashboard dan HP kasir berbunyi.
   - `bhatra.id/pusat/` menampilkan daftar toko.
   - `bhatra.id/daftar/` bisa membuat toko coba.

Aplikasi BHATRA Kasir tidak perlu diubah karena kunci kasir BHATRA dipindahkan apa adanya.

### Kalau ada masalah
Unggah kembali `v1/` ke `public_html`. Database v2 tetap bisa dibaca v1 untuk menu, tetapi pesanan baru dari v1 akan gagal. Pulihkan cadangan di langkah 1 dan hubungi saya.

## Mode link toko (`web/config.js`)

| Pengaturan | Link toko | Perlu |
|---|---|---|
| default | `bhatra.id/?toko=warung-bu-sri` | tidak ada |
| `PRETTY_PATHS: true` | `bhatra.id/warung-bu-sri` | `.htaccess` (sudah ada) |
| `SUBDOMAINS: true` | `warung-bu-sri.namaproduk.id` | domain produk + wildcard DNS `*` dan subdomain wildcard di Hostinger |
| domain sendiri | `warungbusri.com` | isi `custom_domain` toko di tabel `shops` + arahkan domain ke hosting |

Ganti `PRODUCT` dan `ROOT_DOMAIN` setelah nama produk diputuskan.

## Tampilan per toko (migrasi 002)

- **Pemilik** memilih satu dari 8 tema di dashboard (Atur → Tampilan toko): Hangat, Segar, Kopi, Manis, Laut, Pedas, Malam, Polos.
  Paket Pro dan masa coba juga bisa memilih warna utama (ada tombol ambil warna dari logo), jenis huruf, dan pola latar.
- **Admin pusat** mengatur desain khusus di `/pusat/` lewat tombol *Desain khusus* pada kartu toko. Pilihannya: tema, warna, huruf, gambar hero, dan CSS tambahan, dengan pratinjau langsung.
  Ini untuk jasa desain berbayar. Pemilik toko tidak bisa mengubah bagian ini.
- Daftar tema ada di `web/themes.js`. Untuk menambah tema, cukup tambah satu entri.
- Jalankan `002_tampilan.sql` setelah `001` (aman dijalankan ulang).

## Backup & pemantauan (migrasi 003 + GitHub Actions di repo bhatra-kasir, branch main)

- **Backup harian 02.23 WIB** (`.github/workflows/backup.yml`): dump skema public+auth, dienkripsi AES-256, disimpan 30 hari di tab Actions.
  Perlu 2 secret di GitHub (Settings → Secrets and variables → Actions):
  - `DB_PASSWORD`: password database Supabase (Project Settings → Database → Reset database password → Generate).
  - `BACKUP_PASSWORD`: kata sandi panjang buatan sendiri. Simpan di tempat aman, karena tanpa ini backup tidak bisa dibuka.

  Foto banner/logo di Storage tidak ikut backup.
- **Pantau tiap jam 06.41–22.41 WIB** (`.github/workflows/pantau.yml`): situs bisa dibuka, database menjawab, HP kasir toko Pro lapor dalam 60 menit saat jam buka, error browser kurang dari 20 per jam.
  Kalau ada yang gagal, GitHub mengirim email ke pemilik repo. Workflow ini juga menggantikan keepalive.
- **Error di HP pengguna** dicatat lewat `web/pantau.js` dan bisa dilihat di `/pusat/` (24 jam terakhir).

## Paket

Masa coba dan Pro mendapat semua fitur. Dasar tidak mendapat promo/voucher, harga coret, stok harian, banner, lunas otomatis via HP kasir, notifikasi kasir, dan rekap lebih dari 1 hari.
Atur paket di `/pusat/`. Pemilik toko tidak bisa mengubah paketnya sendiri karena dijaga trigger `shops_guard`.

## Uji database

```
bash supabase/tests/jalankan.sh     # perlu PostgreSQL 16 lokal
```

## Uji ujung-ke-ujung (browser)

Menguji pembeli memesan, dashboard pemilik, pendaftaran toko baru, isolasi antar toko, admin pusat, dan tampilan HP (40 uji).
Perlu PostgreSQL 16 lokal, [PostgREST](https://github.com/PostgREST/postgrest/releases) dan Playwright.

```
bash e2e/jalankan.sh              # SEMUA 40 UJI LULUS
```
