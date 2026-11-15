/* ep.js — kerangka episode "cerita yang kena" (dua dunia: A = masalah, B = jalan keluar).
 * Butuh hidup.js + tokoh.js. Pakai: E.mount({A:{...}, B:{...}, label}) lalu E.frame(t, {...}) di setT. */
(function () {
  const E = {}, $ = id => document.getElementById(id);
  const { seg, io, out, spring, elastic, lerp, cl } = H;
  const leaf = (x, y, r, s, c, c2, id) => `<g id="${id}" transform="translate(${x},${y}) rotate(${r}) scale(${s})" data-b="${x},${y},${r},${s}"><path d="M0 0 C40 -70 150 -80 210 -8 C150 56 40 50 0 0Z" fill="${c}"/><path d="M6 0 C70 -14 140 -14 200 -8" stroke="${c2}" stroke-width="6" fill="none"/><path d="M60 -8 L84 -42 M110 -11 L138 -44 M70 -4 L92 26 M120 -8 L146 22" stroke="${c2}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
  const sway = (id, t, amp, sp, ph) => { const e = $(id); if (!e) return; const [x, y, r, s] = e.dataset.b.split(',').map(Number); e.setAttribute('transform', `translate(${x},${y}) rotate(${r + Math.sin(t * sp + ph) * amp}) scale(${s})`); };

  /* ---------- set ruangan ---------- */
  E.set = function (p, o) {
    o = Object.assign({ dinding: '#F6EAD6', motif: '#EEE0C6', bawah: '#EAD9BC', lis: '#C9955A', lantai: '#D9B98C', papan: '#C39A62', kusen: '#15787D', waktu: 'siang', meja: 'makan', taplak: '#FCF5EB', garis: '#F2A07E', mx: 540 }, o);
    const S = { o };
    S.belakang = () => {
      let planks = ''; for (let i = 0; i < 7; i++) planks += `<line x1="-200" y1="${1680 + i * 40}" x2="1280" y2="${1680 + i * 40}" stroke="${o.papan}" stroke-width="3" opacity=".5"/>`;
      const sky = o.waktu === 'malam' ? `<rect x="96" y="566" width="308" height="388" fill="#1C2B4A"/><circle cx="320" cy="650" r="40" fill="#FFF3C4"/><circle cx="304" cy="640" r="34" fill="#1C2B4A"/>${[[140, 620], [200, 700], [260, 600], [370, 760], [150, 790], [230, 820], [350, 590]].map(([x, y], i) => `<circle id="${p}st${i}" cx="${x}" cy="${y}" r="5" fill="#FFF3C4"/>`).join('')}<path d="M96 860 Q170 790 250 840 Q300 810 404 850 V954 H96Z" fill="#12203A"/>`
        : o.waktu === 'sore' ? `<rect x="96" y="566" width="308" height="388" fill="#F9C58A"/><rect x="96" y="566" width="308" height="160" fill="#F7A97A" opacity=".6"/><circle cx="300" cy="820" r="52" fill="#FD5B35" opacity=".9"/><g id="${p}cloud" fill="#fff" opacity=".7"><ellipse cx="170" cy="650" rx="44" ry="14"/><ellipse cx="300" cy="700" rx="34" ry="11"/></g><path d="M96 850 Q170 780 250 830 Q300 800 404 840 V954 H96Z" fill="#5AA078"/>`
          : `<rect x="96" y="566" width="308" height="388" fill="#B9E6EE"/><circle cx="330" cy="640" r="34" fill="#FFD45C"/><g id="${p}cloud" fill="#fff" opacity=".9"><ellipse cx="170" cy="650" rx="44" ry="16"/><ellipse cx="200" cy="638" rx="30" ry="16"/><ellipse cx="300" cy="720" rx="34" ry="12"/><ellipse cx="-60" cy="690" rx="40" ry="14"/></g><path d="M96 830 Q170 730 250 800 Q300 760 404 820 V954 H96Z" fill="#6FB58A"/>`;
      const jam = o.jam ? `<g transform="translate(700,760)"><circle r="96" fill="#5B4636"/><circle r="82" fill="#FCF5EB"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `<rect x="-4" y="-76" width="8" height="${i % 3 ? 10 : 20}" rx="3" fill="#173336" transform="rotate(${i * 30})"/>`).join('')}<rect id="${p}jh" x="-6" y="-46" width="12" height="52" rx="6" fill="#173336"/><rect id="${p}jm" x="-4" y="-68" width="8" height="74" rx="4" fill="#FD5B35"/><circle r="9" fill="#173336"/></g>` : `<g transform="translate(700,770) rotate(-3)"><rect x="-90" y="-70" width="180" height="140" rx="8" fill="#FCF5EB" stroke="#5B4636" stroke-width="10"/><rect x="-72" y="-52" width="144" height="104" fill="#BFE3E0"/><path d="M-72 20 Q-20 -30 20 14 Q44 -6 72 18 V52 H-72Z" fill="#15787D"/><circle cx="34" cy="-22" r="14" fill="#F2A07E"/></g>`;
      return `<defs><pattern id="${p}pt" width="88" height="88" patternUnits="userSpaceOnUse"><g fill="${o.motif}"><ellipse cx="44" cy="20" rx="10" ry="18"/><ellipse cx="44" cy="68" rx="10" ry="18"/><ellipse cx="20" cy="44" rx="18" ry="10"/><ellipse cx="68" cy="44" rx="18" ry="10"/></g></pattern>
      <radialGradient id="${p}gl"><stop offset="0" stop-color="#FFD45C" stop-opacity=".6"/><stop offset="1" stop-color="#FFD45C" stop-opacity="0"/></radialGradient>
      <clipPath id="${p}wc"><rect x="96" y="566" width="308" height="388" rx="18"/></clipPath></defs>
      <rect x="-200" y="-200" width="1480" height="2320" fill="${o.dinding}"/><rect x="-200" y="-200" width="1480" height="1840" fill="url(#${p}pt)"/>
      <rect x="-200" y="1250" width="1480" height="390" fill="${o.bawah}"/><rect x="-200" y="1238" width="1480" height="22" fill="${o.lis}"/><rect x="-200" y="1600" width="1480" height="40" fill="#B77B4A"/>
      <g clip-path="url(#${p}wc)">${sky}</g>
      <rect x="90" y="560" width="320" height="400" rx="24" fill="none" stroke="${o.kusen}" stroke-width="14"/><line x1="250" y1="560" x2="250" y2="960" stroke="${o.kusen}" stroke-width="10"/><rect x="70" y="952" width="360" height="24" rx="10" fill="#0F5C60"/>
      <rect x="60" y="530" width="380" height="18" rx="9" fill="#B77B4A"/>
      <g id="${p}curt"><path d="M70 548 H170 Q180 760 120 800 Q140 900 150 1010 H70Z" fill="#FFFAF0"/><path d="M100 548 Q110 700 96 800 M136 548 Q150 700 118 800" stroke="#E6D8BF" stroke-width="5" fill="none"/><rect x="70" y="786" width="62" height="20" rx="8" fill="#FD5B35" opacity=".85"/></g>
      ${jam}
      <circle id="${p}glow" cx="930" cy="640" r="260" fill="url(#${p}gl)"/>
      <g id="${p}lamp"><rect x="926" y="-220" width="8" height="760" fill="#5B4636"/><g transform="translate(930,560)"><path d="M-70 60 Q-78 -40 0 -40 Q78 -40 70 60Z" fill="#D9A566"/><path d="M-56 60 Q-44 -16 0 -40 M0 -40 Q44 -16 56 60 M-72 16 H72 M0 -40 V60" stroke="#B77B4A" stroke-width="5" fill="none"/><ellipse cx="0" cy="62" rx="70" ry="11" fill="#FFE9A8"/></g></g>
      <rect x="-200" y="1640" width="1480" height="480" fill="${o.lantai}"/>${planks}
      <g transform="translate(1030,1640)"><ellipse cx="-10" cy="4" rx="110" ry="16" fill="#173336" opacity=".18"/>${leaf(-20, -190, -120, 1.25, '#1E8A6E', '#14664F', p + 'p1')}${leaf(-10, -190, -70, 1.35, '#2A9D7C', '#14664F', p + 'p2')}${leaf(-30, -180, -160, 1.05, '#177A5F', '#0F5745', p + 'p3')}${leaf(-6, -200, -95, 1.5, '#1E8A6E', '#14664F', p + 'p4')}
      <path d="M-84 -190 H64 L46 0 H-66Z" fill="#D9A566"/><rect x="-92" y="-204" width="164" height="24" rx="10" fill="#B77B4A"/></g>`;
    };
    S.meja = () => {
      const x = o.mx;
      if (o.meja === 'makan') {
        let str = ''; for (let i = 0; i < 9; i++) str += `<rect x="${x - 372 + i * 86}" y="1430" width="28" height="282" fill="${o.garis}" opacity=".45"/>`;
        return `<ellipse cx="${x}" cy="1722" rx="440" ry="20" fill="#173336" opacity=".2"/>
        <rect x="${x - 390}" y="1412" width="780" height="300" rx="14" fill="${o.taplak}"/>${str}<rect x="${x - 390}" y="1412" width="780" height="40" fill="#173336" opacity=".12"/>
        <rect x="${x - 420}" y="1384" width="840" height="46" rx="16" fill="#C9955A"/><rect x="${x - 420}" y="1412" width="840" height="18" rx="9" fill="#9C6A3C"/>
        <g transform="translate(${x - 250},1384)"><ellipse cx="0" cy="-2" rx="108" ry="15" fill="#fff"/><ellipse cx="0" cy="-4" rx="84" ry="10" fill="#E9E4DA"/><path d="M-66 -6 Q-60 -62 0 -66 Q60 -62 66 -6Z" fill="#FFFDF6"/><path d="M10 -64 Q56 -56 66 -6 H30Z" fill="#E9E4DA" opacity=".7"/><circle cx="-26" cy="-62" r="15" fill="#FD5B35"/><path d="M-10 -66 q16 -14 34 -2" stroke="#2DBE78" stroke-width="9" fill="none" stroke-linecap="round"/>
          <path id="${p}steam1" d="M-18 -90 Q-8 -106 -18 -124" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/><path id="${p}steam2" d="M12 -90 Q22 -106 12 -124" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/></g>
        <g transform="translate(${x + 270},1384)"><rect x="-30" y="-84" width="60" height="84" rx="8" fill="#DFF3F2" opacity=".9"/><rect x="-30" y="-52" width="60" height="52" rx="8" fill="#F2A07E" opacity=".8"/><rect x="-22" y="-80" width="8" height="70" rx="4" fill="#fff" opacity=".6"/></g>`;
      }
      if (o.meja === 'kerja') return `<ellipse cx="${x}" cy="1722" rx="440" ry="20" fill="#173336" opacity=".2"/>
        <rect x="${x - 390}" y="1412" width="780" height="300" rx="20" fill="#5B4636"/><rect x="${x - 390}" y="1412" width="780" height="60" fill="#000" opacity=".2"/><rect x="${x - 340}" y="1500" width="300" height="150" rx="14" fill="none" stroke="#7A6048" stroke-width="6"/><rect x="${x + 40}" y="1500" width="300" height="150" rx="14" fill="none" stroke="#7A6048" stroke-width="6"/><circle cx="${x - 190}" cy="1575" r="12" fill="#C9955A"/><circle cx="${x + 190}" cy="1575" r="12" fill="#C9955A"/>
        <rect x="${x - 420}" y="1384" width="840" height="46" rx="16" fill="#C9955A"/><rect x="${x - 420}" y="1412" width="840" height="18" rx="9" fill="#9C6A3C"/>
        <g transform="translate(${x - 270},1384)">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${-70 + (i % 2) * 8}" y="${-14 - i * 12}" width="130" height="12" rx="3" fill="${i % 2 ? '#FCF5EB' : '#EFE6D6'}" stroke="#CFC5B5" stroke-width="2" transform="rotate(${[2, -3, 1, -2, 3, -1][i]})"/>`).join('')}</g>
        <g transform="translate(${x + 280},1384)"><rect x="-44" y="-70" width="88" height="70" rx="10" fill="#173336"/><rect x="-34" y="-60" width="68" height="20" rx="4" fill="#BFE3E0"/>${[0, 1, 2].map(i => `<rect x="${-34 + i * 25}" y="-32" width="18" height="10" rx="3" fill="#FCF5EB"/><rect x="${-34 + i * 25}" y="-17" width="18" height="10" rx="3" fill="${i == 2 ? '#FD5B35' : '#FCF5EB'}"/>`).join('')}</g>`;
      return `<ellipse cx="${x}" cy="1716" rx="330" ry="20" fill="#173336" opacity=".2"/>
        <rect x="${x - 290}" y="1412" width="580" height="300" rx="20" fill="#173336"/><rect x="${x - 290}" y="1412" width="580" height="60" fill="#0C1F21" opacity=".45"/><rect x="${x - 250}" y="1500" width="500" height="150" rx="16" fill="none" stroke="#2A5357" stroke-width="6"/>
        <text x="${x}" y="1596" text-anchor="middle" font-family="P" font-weight="700" font-size="46" fill="#FCF5EB">RESEPSIONIS</text>
        <rect x="${x - 314}" y="1384" width="628" height="46" rx="16" fill="#C9955A"/><rect x="${x - 314}" y="1412" width="628" height="18" rx="9" fill="#9C6A3C"/>
        <g transform="translate(${x + 200},1384)"><path d="M-36 0 A36 36 0 0 1 36 0 Z" fill="#FFD45C"/><rect x="-44" y="-4" width="88" height="9" rx="4" fill="#E2B33F"/><circle cy="-40" r="8" fill="#E2B33F"/></g>`;
    };
    S.depan = () => `<g id="${p}front">${leaf(-40, 1900, -58, 2.2, '#0F5C60', '#0A4649', p + 'f1')}${leaf(-60, 1930, -25, 2.0, '#13343B', '#0A2A30', p + 'f2')}${leaf(-30, 1940, -82, 1.6, '#15787D', '#0F5C60', p + 'f3')}</g>`;
    S.hidup = (t, st = {}) => {
      const lr = Math.sin(t * 1.3) * 2.2 + H.noise(t * .6, 12) * 1;
      $(p + 'lamp').setAttribute('transform', `rotate(${lr} 930 -220)`); $(p + 'glow').setAttribute('opacity', .85 + .15 * H.noise(t * 3, 40));
      $(p + 'glow').setAttribute('cx', 930 - lr * 12);
      $(p + 'curt').setAttribute('transform', `translate(120,548) skewX(${Math.sin(t * 1.1) * 2.2 + H.noise(t * .7, 31) * 1.2}) translate(-120,-548)`);
      for (let i = 0; i < 7; i++) { const e = $(p + 'st' + i); if (e) e.setAttribute('opacity', .55 + .45 * Math.sin(t * (2 + i * .4) + i)); }
      const c = $(p + 'cloud'); if (c) c.setAttribute('transform', `translate(${(t * 7) % 120},${Math.sin(t * .5) * 3})`);
      [1, 2, 3, 4].forEach(i => sway(p + 'p' + i, t, 2.2, 1.1 + i * .13, i * 1.3)); [1, 2, 3].forEach(i => sway(p + 'f' + i, t, 1.6, .9 + i * .1, i * 2));
      const uap = st.uap === undefined ? 1 : st.uap;
      [[p + 'steam1', 0], [p + 'steam2', .8]].forEach(([id, of]) => { const e = $(id); if (!e) return; const q = ((t * .7 + of) % 1.6) / 1.6; e.setAttribute('transform', `translate(${Math.sin(q * 6) * 4},${-q * 26})`); e.setAttribute('opacity', .85 * Math.sin(Math.PI * q) * uap); });
      if (o.jam) { const h = st.jam === undefined ? 13 : st.jam; $(p + 'jh').setAttribute('transform', `rotate(${h * 30})`); $(p + 'jm').setAttribute('transform', `rotate(${h * 360})`); }
    };
    S.paralaks = c => $(p + 'front').setAttribute('transform', `translate(${-(c.x - 540) * .5 - (c.s - 1) * 260},${-(c.y - 960) * .3 + (c.s - 1) * 420})`);
    return S;
  };

  /* ---------- kerangka halaman ---------- */
  E.mount = function (cfg) {
    const w = k => `<svg id="w${k}" class="full" width="1080" height="1920" viewBox="0 0 1080 1920"><g id="cam${k}"><g id="${k}back"></g><g id="${k}c1"></g><g id="${k}meja"></g><g id="${k}c2"></g><g id="${k}fx"></g><g id="${k}depan"></g></g></svg>`;
    $('stage').innerHTML = `${w('A')}${w('B')}
    <svg class="full" width="1080" height="1920" style="pointer-events:none"><defs><radialGradient id="vig" cx=".5" cy=".55" r=".75"><stop offset=".55" stop-color="#16202A" stop-opacity="0"/><stop offset="1" stop-color="#16202A" stop-opacity=".32"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#vig)"/></svg>
    <div id="dim"></div><div id="html"></div>
    <svg id="fxTop" class="full" width="1080" height="1920" viewBox="0 0 1080 1920" style="z-index:20;pointer-events:none"></svg>
    <div class="cap" id="cap"></div>
    <div class="cta" id="cta"><div class="kom" id="ctaKom">Tulis di komentar</div><div class="big" id="ctaBig"></div><div class="btn" id="ctaBtn">Coba demo gratis</div><div class="url" id="ctaUrl">titikkumpul.id/layanan-penginapan</div><div class="sm" id="ctaSm">TK Penginapan · mulai Rp149rb/bulan</div>
      <svg class="full" width="1080" height="1920" viewBox="0 0 1080 1920"><g id="gCta"></g></svg></div>
    <div class="ov"><div class="h"><span class="tag">IG</span><span class="tag">TikTok</span>@tk.penginapan</div><div class="w">titikkumpul.id/layanan-penginapan</div></div>
    <div class="ilus">${cfg.label || 'Ilustrasi'}</div>`;
    E.S = {};
    ['A', 'B'].forEach(k => { const s = E.S[k] = E.set(k, cfg[k]); $(k + 'back').innerHTML = s.belakang(); $(k + 'meja').innerHTML = s.meja(); $(k + 'depan').innerHTML = s.depan(); });
    $('html').innerHTML = cfg.html || '';
  };
  /* tiap frame: kamera dua dunia, perpindahan A->B (iris), latar hidup, redup saat kartu tampil */
  E.frame = function (t, f) {
    H.cam($('camA'), t, f.camA, f.shakeA || [0, 0, 0]); E.S.A.paralaks(H.kf(t, f.camA)); E.S.A.hidup(t, f.stA || {});
    H.cam($('camB'), t, f.camB, f.shakeB || [0, 0, 0]); E.S.B.paralaks(H.kf(t, f.camB)); E.S.B.hidup(t, f.stB || {});
    H.iris($('wB'), t, f.pindah, .55, { x: f.pindahXY[0], y: f.pindahXY[1] });
    $('dim').style.opacity = .45 * (f.dim || 0);
  };
  // elemen HTML muncul kenyal lalu hilang: gelembung chat, balon kata, stiker
  E.pop = function (el, t, t0, t1, o = {}) {
    if (typeof el === 'string') el = $(el);
    const k = elastic(seg(t, t0, t0 + .55)), ko = t1 === null ? 0 : seg(t, t1 - .22, t1), r = o.rot || 0;
    el.style.opacity = t < t0 ? 0 : 1 - ko;
    el.style.transform = `translate(${(o.goyang || 0) * Math.sin(t * 9 + (o.fase || 0))}px,${-ko * 30 + (o.apung || 3) * Math.sin(t * 2.2 + (o.fase || 0))}px) rotate(${r + (1 - k) * -14}deg) scale(${k * (1 - ko * .2) * H.punch(t, t0, .3, .06)})`;
  };
  // kartu/HP masuk dengan pegas dan keluar
  E.kartu = function (el, t, t0, t1, o = {}) {
    if (typeof el === 'string') el = $(el);
    const pin = spring(seg(t, t0, t0 + .8), 1.4, 5), po = io(seg(t, t1 - .4, t1));
    el.style.opacity = Math.min(seg(t, t0, t0 + .2), 1 - po);
    el.style.transform = `translate(0,${(1 - pin) * 160 + po * -80 + H.wiggle(t, .5, 6, 5)}px) rotate(${(1 - pin) * -6 + H.wiggle(t, .4, 1, 6)}deg) scale(${(.8 + .2 * pin) * (o.pk || 1)})`;
    return Math.min(seg(t, t0, t0 + .3), 1 - po);
  };
  // layar penutup: pertanyaan komentar + satu CTA + tokoh masuk melambai
  E.cta = function (t, t0, o) {
    H.iris($('cta'), t, t0, .5, { x: o.xy[0], y: o.xy[1] });
    E.pop('ctaKom', t, t0 + .15, null, { rot: -3 });
    H.text($('ctaBig'), o.tanya, t, t0 + .25, { stagger: .07, hlText: '#16202A' });
    const b0 = t0 + 1.1, bk = elastic(seg(t, b0, b0 + .6));
    $('ctaBtn').style.transform = `scale(${bk * (1 + .03 * Math.sin((t - b0) * 7) * seg(t, b0 + .4, b0 + .6))})`;
    H.css($('ctaUrl'), { y: (1 - out(seg(t, b0 + .2, b0 + .55))) * 40, o: seg(t, b0 + .2, b0 + .45) });
    $('ctaSm').style.opacity = .75 * seg(t, b0 + .4, b0 + .7);
    if (t > t0) {
      const w0 = t0 + .15, w1 = t0 + .95, jw = t < w1, jx = lerp(1320, 540, out(seg(t, w0, w1))), jk = jw ? T.jalan(t, 13) : {};
      const hj = H.hop(t, w1 + .05, .36, 20), wv = seg(t, w1, w1 + .2);
      const aR = (jk.armR ?? -12) * (1 - wv) + wv * (-150 + Math.sin(t * 12) * 14), aL = o.who === 'acong' ? 20 : 30;
      const opt = T.hidup(t, 3, { ...jk, armL: aL, armR: aR, tilt: 4, lean: jw ? -4 : 0, air: hj.y, squash: [hj.sx, hj.sy], propL: o.who === 'acong' ? T.nota(aL, Math.sin(t * 6) * 5) : T.cangkir(aL, t), face: { look: [-3, 0], brow: 6, eye: wv > 0 ? 'happy' : 'normal', mouth: 'open', open: wv > 0 ? 1 : .5 } });
      $('gCta').innerHTML = (o.who === 'acong' ? T.acong : T.jaka)(jx, 1290, 1.12, opt);
    } else $('gCta').innerHTML = '';
  };
  E.sendok = ang => `<g transform="rotate(${-ang}) translate(0,-26)"><rect x="-5" y="-74" width="10" height="92" rx="5" fill="#C9CED1"/><ellipse cx="0" cy="-84" rx="19" ry="25" fill="#E3E7E9"/><ellipse cx="-4" cy="-90" rx="7" ry="11" fill="#fff" opacity=".7"/></g>`;
  window.E = E;
})();
