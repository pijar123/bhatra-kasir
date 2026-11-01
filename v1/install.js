/* Pasang sebagai aplikasi (PWA) — dipakai halaman pembeli & owner */
(() => {
  const $ = id => document.getElementById(id);
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const app = document.body.dataset.app === 'admin' ? 'BHATRA Owner' : 'BHATRA';
  const KEY = 'bhatra_install_x_' + (document.body.dataset.app || 'shop');
  let deferred = null, waiters = [];
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const bar = $('installBar');
  const showBar = () => { if (bar && !standalone() && !get(KEY)) bar.hidden = false; };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; waiters.splice(0).forEach(f => f()); showBar(); });
  window.addEventListener('appinstalled', () => { if (bar) bar.hidden = true; set('bhatra_installed_' + app, '1'); toast(app + ' terpasang ✓ Cek layar utama'); });
  if (ios) { const h = $('installHint'); if (h) h.textContent = 'Ketuk Pasang untuk caranya'; showBar(); }

  function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 2600); }

  // iPhone: Apple tidak mengizinkan pasang otomatis, jadi tunjukkan tombol Bagikan dengan panah.
  function iosHint() {
    let d = $('iosHint');
    if (!d) {
      d = document.createElement('div'); d.id = 'iosHint'; d.className = 'ios-hint'; document.body.append(d);
      d.addEventListener('click', () => { d.hidden = true; });
    }
    d.innerHTML = `<div class="ios-card"><b>Pasang ${app}</b><p>1. Ketuk <span class="ios-share" aria-label="Bagikan"></span> <b>Bagikan</b> di bawah layar</p><p>2. Pilih <b>Tambah ke Layar Utama</b></p></div><div class="ios-arrow" aria-hidden="true">↓</div>`;
    d.hidden = false;
  }

  async function install(btn) {
    if (standalone()) return toast(app + ' sudah terbuka sebagai aplikasi');
    if (ios) return iosHint();
    if (!deferred) {
      // Chrome kadang butuh sebentar sebelum siap memasang.
      const old = btn && btn.textContent; if (btn) btn.textContent = 'Menyiapkan…';
      await new Promise(r => { waiters.push(r); setTimeout(r, 3000); });
      if (btn) btn.textContent = old;
    }
    if (deferred) {
      deferred.prompt(); const r = await deferred.userChoice; deferred = null;
      if (r.outcome === 'accepted' && bar) bar.hidden = true;
      return;
    }
    // Tidak ada tawaran pasang dari Chrome: biasanya karena sudah terpasang.
    toast(get('bhatra_installed_' + app) ? app + ' sudah terpasang. Cari ikonnya di layar utama' : 'Buka lewat Chrome, lalu ketuk ⋮ → Instal aplikasi');
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-install]');
    if (b) { e.preventDefault(); install(b); }
    if (e.target.closest('#installX')) { bar.hidden = true; set(KEY, '1'); }
  });
})();
