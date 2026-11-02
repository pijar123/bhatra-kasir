# BHATRA Kasir

Aplikasi Android kecil untuk Warung Jajan BHATRA: membaca notifikasi uang masuk dari DANA
dan menandai pesanan QRIS di bhatra.id sebagai **Lunas** secara otomatis (cocok berdasarkan nominal + kode unik).

## Install
1. Buka tab **Releases** → unduh `bhatra-kasir.apk` terbaru di HP Android.
2. Izinkan "Install dari sumber tidak dikenal" saat diminta.
3. Buka aplikasi → tempel kode rahasia (dari bhatra.id/admin.html → Atur → Salin pengaturan) → izinkan baca notifikasi → matikan penghemat baterai → Kirim tes.

APK dibuat otomatis oleh GitHub Actions setiap ada perubahan di branch `main`.

## Aplikasi Poster (web/poster)
Aplikasi web (PWA) untuk bikin poster BHATRA dari HP, bisa dipakai tanpa sinyal setelah dipasang.
Alamat: https://bhatra.id/poster/ — dikirim otomatis ke hosting lewat workflow **Kirim aplikasi Poster ke bhatra.id**
setiap ada perubahan di `web/poster/`. Isi secret `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` (dari hPanel → Akun FTP) sekali saja.
Saat mengubah file aplikasi, naikkan `VERSI` di `web/poster/sw.js` supaya HP mengambil versi baru.
