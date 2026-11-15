/* hidup.js — pustaka gerak untuk video kartun @tk.penginapan
 *
 * Pakai di scene.html:  <script src="hidup.js"></script>  sebelum <script> scene.
 * Semua fungsi murni bergantung pada t (detik), jadi aman untuk render frame
 * per frame lewat setT(t). Tidak ada Math.random() dan tidak ada timer.
 *
 * Isi:
 *   Easing    : io, out, inn, back, elastic, bounce, spring, anticipate
 *   Waktu     : seg, kf (keyframe), drag (gerak susulan)
 *   Acak halus: noise, wiggle
 *   Tokoh     : blink, breath, walk, footfalls, hop, land, punch, shake
 *   Teks      : text (muncul per kata + sorotan menyapu), count, rp
 *   Efek      : burst (konfeti/bintang), puff (debu langkah), ring, lines
 *   Kamera    : cam (zoom/geser), iris (transisi lingkaran)
 *   Elemen    : tf (SVG), css (HTML)
 *   Suara     : cue, cuesPy (daftar SFX yang selaras dengan gerak)
 */
(function () {
  const H = {};
  const PI = Math.PI;

  /* ---------- dasar ---------- */
  H.cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  H.seg = (t, a, b) => H.cl((t - a) / (b - a));
  H.lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- easing (masukan 0..1) ---------- */
  H.io = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  H.out = x => 1 - Math.pow(1 - x, 3);
  H.inn = x => x * x * x;
  H.back = x => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  // kenyal: melewati target lalu bergetar sebentar. Cocok untuk badge, tombol, stiker.
  H.elastic = x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * PI / 3)) + 1);
  // memantul di lantai. Cocok untuk benda jatuh.
  H.bounce = x => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };
  // pegas: osc = jumlah ayunan, damp = seberapa cepat tenang. Cocok untuk HP/kartu masuk.
  H.spring = (x, osc = 1.5, damp = 5) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-damp * x) * Math.cos(osc * 2 * PI * x));
  // ancang-ancang: mundur sedikit dulu, baru maju melewati target.
  H.anticipate = (x, amt = 0.15) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.25 ? -amt * Math.sin(PI * x / 0.25) : H.back((x - 0.25) / 0.75));

  /* ---------- keyframe ----------
   * H.kf(t, [[0, 0], [1, 100, H.out], [2, 50, H.io]])
   * Nilai boleh angka, array, atau objek {x, y, s}. Ease berlaku untuk segmen MENUJU frame itu. */
  const mix = (a, b, k) => {
    if (typeof a === 'number') return a + (b - a) * k;
    if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], k));
    const o = {}; for (const key in a) o[key] = mix(a[key], b[key] === undefined ? a[key] : b[key], k); return o;
  };
  H.kf = (t, fr) => {
    if (t <= fr[0][0]) return fr[0][1];
    for (let i = 1; i < fr.length; i++) {
      if (t <= fr[i][0]) {
        const k = (t - fr[i - 1][0]) / (fr[i][0] - fr[i - 1][0]);
        return mix(fr[i - 1][1], fr[i][1], (fr[i][2] || H.io)(k));
      }
    }
    return fr[fr.length - 1][1];
  };
  // gerak susulan: rambut, koper, anting mengikuti induknya dengan telat + sedikit kebablasan.
  H.drag = (fn, t, lag = 0.12, over = 0.6) => { const a = fn(t - lag), b = fn(t - 2 * lag); return a + (a - b) * over; };

  /* ---------- acak halus yang selalu sama tiap render ---------- */
  const hash = (n, s) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  H.noise = (t, seed = 0) => { // -1..1
    const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    return (hash(i, seed) * (1 - u) + hash(i + 1, seed) * u) * 2 - 1;
  };
  H.wiggle = (t, freq = 1, amp = 1, seed = 0) => H.noise(t * freq, seed) * amp;
  const rng = seed => () => { // mulberry32
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };

  /* ---------- tokoh ---------- */
  // kedip tidak teratur, kadang kedip ganda. Hasil = skala Y mata (1 terbuka, 0.1 tertutup).
  H.blink = (t, seed = 0, every = 2.8) => {
    const cell = Math.floor(t / every), at = cell * every + 0.3 + hash(cell, seed + 9) * (every - 0.9);
    const one = c => { const d = Math.abs(t - c); return d < 0.07 ? 0.1 + 0.9 * (d / 0.07) : 1; };
    const dbl = hash(cell, seed + 3) > 0.72;
    return Math.min(one(at), dbl ? one(at + 0.26) : 1);
  };
  H.breath = (t, amp = 4, rate = 2.2) => Math.sin(t * rate) * amp;
  // siklus jalan. rate 12 = langkah cepat ceria.
  H.walk = (t, rate = 12) => {
    const s = Math.sin(t * rate);
    return { step: s, bob: -Math.abs(s) * 10, legL: s * 18, legR: -s * 18, armL: -s * 16, armR: s * 16 };
  };
  // waktu kaki menapak antara t0..t1 (untuk debu langkah dan SFX langkah).
  H.footfalls = (t0, t1, rate = 12) => {
    const out = []; for (let k = Math.ceil(t0 * rate / PI); k * PI / rate < t1; k++) out.push(k * PI / rate); return out;
  };
  // lompat kecil senang: {y, sx, sy}. Badan memanjang saat naik, memendek saat mendarat.
  H.hop = (t, start, dur = 0.45, h = 28) => {
    const x = H.seg(t, start, start + dur), l = H.seg(t, start + dur, start + dur + 0.25);
    const pre = H.seg(t, start - 0.12, start);
    let sy = 1 - 0.07 * Math.sin(PI * pre) * (t < start ? 1 : 0) + 0.08 * Math.sin(PI * x) - 0.1 * Math.sin(PI * l);
    return { y: h * Math.sin(PI * x), sx: 1 / sy, sy };
  };
  // gepeng sesaat ketika berhenti atau mendarat: [sx, sy]
  H.land = (t, start, dur = 0.4, amt = 0.08) => {
    const x = H.seg(t, start, start + dur), sy = 1 - amt * Math.sin(PI * x) * (1 - x) * 2; return [1 / sy, sy];
  };
  // denyut penekanan (skala). Pakai tepat di ketukan atau saat angka muncul.
  H.punch = (t, start, dur = 0.3, amt = 0.08) => { const x = H.seg(t, start, start + dur); return 1 + amt * Math.sin(PI * x) * (1 - x) * 2; };
  // getar yang mereda: [x, y, rot]
  H.shake = (t, start, dur = 0.4, amp = 12, seed = 0) => {
    const x = H.seg(t, start, start + dur); if (x <= 0 || x >= 1) return [0, 0, 0];
    const k = (1 - x) * amp;
    return [H.noise(t * 38, seed) * k, H.noise(t * 38, seed + 1) * k, H.noise(t * 30, seed + 2) * k * 0.08];
  };

  /* ---------- pasang transform ---------- */
  // SVG: H.tf(el, {x, y, r, sx, sy, ox, oy})  (ox, oy = titik poros putar/skala)
  H.tf = (el, o) => {
    const { x = 0, y = 0, r = 0, sx = 1, sy = sx, ox = 0, oy = 0 } = o;
    el.setAttribute('transform', `translate(${x + ox},${y + oy}) rotate(${r}) scale(${sx},${sy}) translate(${-ox},${-oy})`);
  };
  // HTML: H.css(el, {x, y, r, s, o}, awalan)  awalan mis. 'translateX(-50%)'
  H.css = (el, o, pre = '') => {
    const { x = 0, y = 0, r = 0, s = 1 } = o;
    el.style.transform = `${pre} translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
    if (o.o !== undefined) el.style.opacity = o.o;
  };

  /* ---------- teks kinetik ----------
   * H.text(el, 'Libur ramai,|*tim tetap tenang.*', t, mulai, {end: 2.6})
   *   |  = baris baru      *...* = sorotan kuning yang menyapu dari kiri
 *   opsi bg: warna alas di belakang teks biasa, pakai kalau latarnya ramai
   * Kata muncul satu per satu, jadi mata penonton ikut membaca. */
  H.text = (el, str, t, start, o = {}) => {
    const { stagger = 0.07, dur = 0.42, end = null, rise = 44, hl = '#FFD45C', hlText = null, bg = null } = o;
    if (el.__k !== str + bg) {
      el.__k = str + bg; el.innerHTML = ''; el.__w = []; el.__h = [];
      str.split('|').forEach((line, li) => {
        if (li) el.appendChild(document.createElement('br'));
        line.split('*').forEach((part, pi) => {
          if (!part) return;
          let host = el;
          if (pi % 2) {
            host = document.createElement('span');
            host.style.cssText = `display:inline-block;padding:0 14px;border-radius:10px;background:linear-gradient(${hl},${hl}) no-repeat left center/0% 100%`;
            if (hlText) host.style.color = hlText;
            host.__i = el.__w.length; el.__h.push(host); el.appendChild(host);
          } else if (bg) { // alas warna di belakang teks biasa, untuk latar yang ramai
            host = document.createElement('span');
            host.style.cssText = `display:inline-block;padding:0 16px;border-radius:12px;background:${bg}`;
            el.appendChild(host);
          }
          part.trim().split(/\s+/).forEach((w, wi) => {
            if (wi || (host === el && host.lastChild && host.lastChild.nodeName === 'SPAN')) host.appendChild(document.createTextNode(' '));
            const s = document.createElement('span'); s.textContent = w; s.style.display = 'inline-block';
            host.appendChild(s); el.__w.push(s);
          });
        });
      });
    }
    el.__w.forEach((s, i) => {
      const k = H.seg(t, start + i * stagger, start + i * stagger + dur), b = H.back(k);
      s.style.opacity = H.cl(k * 2.5);
      s.style.transform = `translateY(${(1 - b) * rise}px) rotate(${(1 - k) * -7}deg) scale(${0.7 + 0.3 * b})`;
    });
    el.__h.forEach(h => {
      const s0 = start + h.__i * stagger + 0.08;
      h.style.backgroundSize = `${H.out(H.seg(t, s0, s0 + 0.35)) * 100}% 100%`;
    });
    const ko = end === null ? 0 : H.seg(t, end - 0.2, end);
    el.style.opacity = 1 - ko; el.style.transform = `translateY(${-ko * 30}px)`;
  };
  // angka menghitung naik. Ingat aturan: beri label "Contoh hitungan".
  H.count = (t, start, dur, a, b) => Math.round(H.lerp(a, b, H.out(H.seg(t, start, start + dur))));
  H.rp = n => 'Rp' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /* ---------- efek partikel (host = <g> atau <svg>) ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const grp = (host, id, build) => {
    let g = host.querySelector('#' + id);
    if (!g) { g = mk('g', { id, opacity: 0 }); host.appendChild(g); build(g); }
    return g;
  };
  const STAR = 'M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3Z';
  // ledakan konfeti/bintang/titik. kind: 'confetti' | 'star' | 'dot'
  H.burst = (host, id, t, start, o = {}) => {
    const { x = 540, y = 960, n = 16, dur = 1.1, dir = -90, spread = 140, speed = 520, gravity = 1100,
      colors = ['#FFD45C', '#FD5B35', '#15787D', '#2DBE78'], size = 1, kind = 'confetti', seed = 1 } = o;
    const g = grp(host, id, g => {
      const r = rng(seed * 977 + 13); g.__p = [];
      for (let i = 0; i < n; i++) {
        const a = (dir + (r() - 0.5) * spread) * PI / 180, v = speed * (0.45 + r() * 0.75), c = colors[i % colors.length];
        const k = kind === 'mix' ? ['confetti', 'star', 'dot'][i % 3] : kind;
        const e = k === 'star' ? mk('path', { d: STAR, fill: c })
          : k === 'dot' ? mk('circle', { r: 7, fill: c })
            : mk('rect', { x: -9, y: -5, width: 18, height: 10, rx: 2, fill: c });
        g.appendChild(e); g.__p.push({ e, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r0: r() * 360, sp: (r() - 0.5) * 900, sc: (0.7 + r() * 0.9) * size * (k === 'star' ? 1.6 : 1) });
      }
    });
    const k = H.seg(t, start, start + dur);
    g.setAttribute('opacity', k <= 0 || k >= 1 ? 0 : 1); if (k <= 0 || k >= 1) return;
    const tt = k * dur;
    g.__p.forEach(p => {
      const s = p.sc * H.back(H.cl(k / 0.15)) * (1 - H.seg(k, 0.7, 1));
      p.e.setAttribute('transform', `translate(${x + p.vx * tt},${y + p.vy * tt + 0.5 * gravity * tt * tt}) rotate(${p.r0 + p.sp * tt}) scale(${s})`);
    });
  };
  // gumpalan debu di kaki saat menapak atau mendarat
  H.puff = (host, id, t, start, o = {}) => {
    const { x = 540, y = 1680, color = '#D9C9AE', dur = 0.5, size = 1 } = o;
    const g = grp(host, id, g => { g.__c = [-1, 0, 1].map(i => { const c = mk('circle', { fill: color }); g.appendChild(c); return c; }); });
    const k = H.seg(t, start, start + dur);
    g.setAttribute('opacity', k <= 0 || k >= 1 ? 0 : 0.85 * (1 - k)); if (k <= 0 || k >= 1) return;
    const e = H.out(k);
    g.__c.forEach((c, i) => { c.setAttribute('cx', x + (i - 1) * 34 * e * size); c.setAttribute('cy', y - (i === 1 ? 20 : 8) * e * size); c.setAttribute('r', (8 + 14 * e) * size); });
  };
  // cincin melebar: tap jari, bel, notifikasi
  H.ring = (host, id, t, start, o = {}) => {
    const { x = 540, y = 960, r = 70, color = '#FFD45C', dur = 0.5, w = 10 } = o;
    const g = grp(host, id, g => { g.__c = mk('circle', { fill: 'none', stroke: color }); g.appendChild(g.__c); });
    const k = H.seg(t, start, start + dur);
    g.setAttribute('opacity', k <= 0 || k >= 1 ? 0 : 1 - k); if (k <= 0 || k >= 1) return;
    g.__c.setAttribute('cx', x); g.__c.setAttribute('cy', y); g.__c.setAttribute('r', r * H.out(k)); g.__c.setAttribute('stroke-width', w * (1 - k) + 1);
  };
  // garis kejut ala komik. arc = [dariDerajat, sampaiDerajat]
  H.lines = (host, id, t, start, o = {}) => {
    const { x = 540, y = 960, n = 8, r0 = 50, r1 = 120, color = '#FD5B35', dur = 0.45, w = 9, arc = [0, 360] } = o;
    const g = grp(host, id, g => { g.__l = []; for (let i = 0; i < n; i++) { const l = mk('line', { stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }); g.appendChild(l); g.__l.push(l); } });
    const k = H.seg(t, start, start + dur);
    g.setAttribute('opacity', k <= 0 || k >= 1 ? 0 : 1); if (k <= 0 || k >= 1) return;
    const a0 = H.lerp(r0, r1, H.out(H.seg(k, 0.3, 1))), a1 = H.lerp(r0, r1, H.out(H.seg(k, 0, 0.6)));
    g.__l.forEach((l, i) => {
      const full = arc[1] - arc[0] >= 360, a = (arc[0] + (arc[1] - arc[0]) * (full ? i / n : (n === 1 ? 0.5 : i / (n - 1)))) * PI / 180;
      l.setAttribute('x1', x + Math.cos(a) * a0); l.setAttribute('y1', y + Math.sin(a) * a0);
      l.setAttribute('x2', x + Math.cos(a) * a1); l.setAttribute('y2', y + Math.sin(a) * a1);
    });
  };

  /* ---------- kamera & transisi ----------
   * H.cam(el, t, [[0, {x:540, y:960, s:1}], [2, {x:540, y:1300, s:1.2}, H.io]], getar)
   * x, y = titik yang dibawa ke tengah layar; s = zoom (minimal 1). Getar hanya terasa saat s > 1.
   * Pasang pada pembungkus adegan saja. Overlay akun (.ov) harus tetap di luar supaya tidak ikut bergerak. */
  H.cam = (el, t, frames, shake = [0, 0, 0], W = 1080, Ht = 1920) => {
    const c = H.kf(t, frames), s = Math.max(1, c.s === undefined ? 1 : c.s);
    // titik fokus dijepit supaya tepi adegan tidak pernah terlihat kosong
    const fx = H.cl(c.x, W / 2 / s, W - W / 2 / s), fy = H.cl(c.y, Ht / 2 / s, Ht - Ht / 2 / s);
    const m = (s - 1) * 0.5, sx = H.cl(shake[0], -W * m, W * m) * (s > 1 ? 0.5 : 0), sy = H.cl(shake[1], -Ht * m, Ht * m) * (s > 1 ? 0.5 : 0);
    el.style.transformOrigin = '0 0';
    el.style.transform = `translate(${W / 2 - fx * s + sx}px,${Ht / 2 - fy * s + sy}px) scale(${s})`;
  };
  // transisi lingkaran membuka dari titik (x, y), mis. dari kunci menuju layar CTA
  H.iris = (el, t, start, dur = 0.5, o = {}) => {
    const { x = 540, y = 960, max = 2300 } = o, k = H.io(H.seg(t, start, start + dur));
    el.style.opacity = t >= start ? 1 : 0;
    el.style.clipPath = `circle(${k * max}px at ${x}px ${y}px)`;
  };

  /* ---------- penanda suara ----------
   * Tulis H.cue('pop', 0.1) di samping gerakannya. Setelah halaman dimuat,
   * render.py bisa mengambil H.cuesPy() untuk ditempel ke skrip suara. */
  window.CUES = [];
  H.cue = (name, t, arg) => { window.CUES.push([name, +t.toFixed(3), arg]); };
  H.cuesPy = () => window.CUES.slice().sort((a, b) => a[1] - b[1])
    .map(([n, t, a]) => `${n}(${t}${a === undefined ? '' : ',' + a})`).join('; ');

  window.H = H;
})();
