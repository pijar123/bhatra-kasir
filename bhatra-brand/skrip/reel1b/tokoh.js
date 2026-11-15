/* tokoh.js — rig tokoh series "Cerita Resepsionis Rara" untuk video kartun.
 *
 * Desain (rambut, warna, pakaian) mengikuti panduan-gaya.md. Yang baru:
 *   - wajah terpisah: alis, mata (kedip, lirik), mulut (bicara, ekspresi)
 *   - satu warna bayangan di badan, dagu, dan bawah rambut
 *   - tangan berjempol, kaki + sepatu, bayangan di lantai
 *
 * Pakai:  T.rara(x, y, skala, opsi)  T.bimo(...)  T.jaka(...)  T.acong(...)  T.yanti(...)   -> string SVG
 *   x, y = posisi TENGAH KEPALA. Telapak kaki ada di y + 552 * skala.
 *
 * Opsi (semua boleh dikosongkan):
 *   tilt   miring kepala (derajat)        lean   condong badan
 *   armL, armR  sudut lengan (0 = lurus ke bawah, minus = ke kanan layar)
 *   propL, propR  benda di tangan (string SVG, digambar DI DEPAN tangan)
 *   legs   false untuk menyembunyikan kaki (di kasur, di balik meja tinggi)
 *   legL, legR  ayunan kaki              air    tinggi lompatan (bayangan tetap di lantai)
 *   squash [sx, sy] gepeng/memanjang      dy     geser naik-turun (napas)
 *   hair   goyang rambut                  flip   true = menghadap kiri
 *   face: { look:[x,y], brow, browTilt, blink (1 buka .. 0.1 tutup),
 *           eye:'normal'|'happy'|'wide'|'line',  mouth:'smile'|'open'|'o'|'sad'|'flat'|'wavy'|'sleep', open:0..1 }
 *
 * Supaya tokoh SELALU hidup, bungkus opsinya dengan T.hidup(t, seed, opsi):
 *   T.rara(320, 1085, 1.2, T.hidup(t, 1, {armR: -40}))
 * Itu menambah napas, kedip tak teratur, kepala bergerak halus, dan rambut menyusul.
 * Butuh hidup.js dimuat lebih dulu.
 */
(function () {
  const T = {}; let uid = 0;
  const INK = '#2B2321';

  function hand(c, th) {
    return `<circle r="27" fill="${c.skin}"/><circle cx="${18 * th}" cy="-16" r="12" fill="${c.skin}"/><path d="M-20 12 Q0 26 20 12" stroke="${c.sk2}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>`;
  }
  function arm(c, x, y, ang, len, prop, th) {
    return `<g transform="translate(${x},${y}) rotate(${ang})"><rect x="-23" y="-10" width="46" height="${len + 10}" rx="23" fill="${c.col}"/><rect x="2" y="-4" width="21" height="${len}" rx="10" fill="${c.col2}" opacity=".45"/><g transform="translate(0,${len})">${hand(c, th)}${prop || ''}</g></g>`;
  }
  function face(c, f) {
    const { look = [0, 0], brow = 0, browTilt = 0, mouth = 'smile', blink = 1, eye = 'normal', open = 1 } = f;
    const ink = c.ink || INK, r = c.eyeR || 11, my = c.mouthY || 0;
    const one = x => {
      if (eye === 'happy') return `<path d="M${x - 14} 10 Q${x} -10 ${x + 14} 10" stroke="${ink}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
      if (eye === 'line') return `<path d="M${x - 13} 6 H${x + 13}" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
      if (eye === 'wide') return `<circle cx="${x}" cy="4" r="19" fill="#fff"/><circle cx="${x + look[0] * .6}" cy="${6 + look[1] * .6}" r="7" fill="${ink}"/>`;
      if (blink < 0.25) return `<path d="M${x - 13} 6 Q${x} 16 ${x + 13} 6" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
      return `<g transform="translate(${x + look[0]},${5 + look[1]}) scale(1,${blink})"><ellipse rx="${r}" ry="${r + 3}" fill="${ink}"/><circle cx="-3.5" cy="-5" r="4" fill="#fff"/></g>`;
    };
    const br = (x, s) => `<path d="M-17 0 Q0 -9 17 0" transform="translate(${x},${-27 - brow - (eye === 'wide' ? 8 : 0)}) rotate(${s * browTilt})" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    let m;
    if (mouth === 'open') { const h = 14 + 32 * open; m = `<path d="M-28 30 Q0 ${30 + h * 1.45} 28 30 Z" fill="${ink}"/>${open > .5 ? `<path d="M-14 ${30 + h * .42} Q0 ${30 + h * .78} 14 ${30 + h * .42} Q0 ${30 + h * .3} -14 ${30 + h * .42}Z" fill="#FD7A5C"/>` : ''}<path d="M-22 32 Q0 40 22 32" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>`; }
    else if (mouth === 'o') m = `<ellipse cx="0" cy="46" rx="13" ry="17" fill="${ink}"/>`;
    else if (mouth === 'sleep') m = `<ellipse cx="0" cy="44" rx="9" ry="7" fill="${ink}"/>`;
    else if (mouth === 'sad') m = `<path d="M-22 50 Q0 34 22 50" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    else if (mouth === 'wavy') m = `<path d="M-24 46 Q-12 36 0 46 Q12 56 24 46" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    else if (mouth === 'flat') m = `<path d="M-20 44 H20" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    else m = `<path d="M-26 36 Q0 60 26 36" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    return `<circle cx="-54" cy="32" r="14" fill="#FD5B35" opacity=".32"/><circle cx="54" cy="32" r="14" fill="#FD5B35" opacity=".32"/>${br(-30, -1)}${br(30, 1)}${one(-30)}${one(30)}<g transform="translate(0,${my})">${m}</g>`;
  }
  function legs(c, o) {
    const leg = (x, rot) => `<g transform="translate(${x},330) rotate(${rot})"><rect x="-22" y="0" width="44" height="205" rx="20" fill="${c.pants}"/><rect x="2" y="6" width="20" height="195" rx="10" fill="#000" opacity=".22"/>${c.shoe}</g>`;
    return leg(-32, o.legL || 0) + leg(32, o.legR || 0);
  }
  function build(c, x, y, s, o) {
    const id = 'tk' + (uid++), tilt = o.tilt || 0, lean = o.lean || 0, hair = o.hair || 0, air = o.air || 0;
    const [sx, sy] = o.squash || [1, 1], hasLegs = o.legs !== false && !c.body, w = c.w;
    return `<g transform="translate(${x},${y}) scale(${s * (o.flip ? -1 : 1)},${s})">
  ${(hasLegs || c.body) && o.shadow !== false ? `<ellipse cx="4" cy="556" rx="${118 * (1 - air / 400)}" ry="${18 * (1 - air / 400)}" fill="#173336" opacity="${.2 * (1 - air / 300)}"/>` : ''}
  <g transform="translate(0,${(o.dy || 0) - air}) translate(0,552) scale(${sx},${sy}) translate(0,-552)">
   ${hasLegs ? legs(c, o) : ''}
   <g transform="rotate(${lean} 0 340)">
    ${c.hairBack ? `<g transform="rotate(${tilt * .6 + hair})">${c.hairBack}</g>` : ''}
    ${c.body ? c.body(o) : `<rect x="${-w / 2}" y="92" width="${w}" height="${hasLegs ? 270 : 330}" rx="${c.rx}" fill="${c.col}"/>
    <path d="M${w * .18} 92 Q${w / 2} 92 ${w / 2} ${92 + c.rx} V${hasLegs ? 362 - c.rx : 422} Q${w / 2} ${hasLegs ? 362 : 422} ${w * .18} ${hasLegs ? 362 : 422} Z" fill="${c.col2}" opacity=".38"/>`}
    ${c.deco}
    ${arm(c, -w / 2 + 14, 130, o.armL === undefined ? 12 : o.armL, c.armLen, o.propL, -1)}
    ${arm(c, w / 2 - 14, 130, o.armR === undefined ? -12 : o.armR, c.armLen, o.propR, 1)}
    <rect x="-16" y="60" width="32" height="46" fill="${c.skin}"/><rect x="-16" y="60" width="32" height="22" fill="${c.sk2}" opacity=".7"/>
    <g transform="rotate(${tilt})">
     <clipPath id="${id}"><circle r="${c.r}"/></clipPath><circle r="${c.r}" fill="${c.skin}"/>
     <g clip-path="url(#${id})">${c.headShade}<ellipse cx="0" cy="${c.r + 16}" rx="${c.r * .8}" ry="26" fill="${c.sk2}" opacity=".35"/></g>
     ${c.hairFront(hair, tilt)}
     ${face(c, o.face || {})}
     ${c.extra ? c.extra(o) : ''}
    </g>
   </g>
  </g></g>`;
  }

  /* ---------- Rara: resepsionis, wolf cut lilac, anting kuning, seragam teal ---------- */
  const RARA = {
    skin: '#C98B5F', sk2: '#A9703F', col: '#15787D', col2: '#0B4F53', w: 224, rx: 72, r: 88, armLen: 150, pants: '#16202A',
    shoe: `<path d="M-30 196 H30 Q46 196 46 212 V222 H-30 Z" fill="#FFD45C"/><path d="M-30 190 H18 Q40 190 42 208 H-30 Z" fill="#FCF5EB"/>`,
    hairBack: `<path d="M-108 -20 C-114 -118 114 -118 108 -20 L116 62 L96 52 L108 108 L82 88 L84 128 L56 104 L-56 104 L-84 128 L-82 88 L-108 108 L-96 52 L-116 62 Z" fill="#B58BF5"/><path d="M60 -80 C100 -60 110 -10 108 -20 L116 62 L96 52 L108 108 L82 88 L84 128 L56 104 Z" fill="#9670DE" opacity=".55"/>`,
    deco: `<path d="M-32 94 L0 144 L32 94 Z" fill="#fff"/><rect x="-70" y="176" width="74" height="32" rx="7" fill="#FFD45C"/><rect x="-60" y="188" width="40" height="7" rx="3" fill="#173336" opacity=".5"/>`,
    headShade: `<path d="M-98 6 C-96 -98 96 -98 98 6 C84 -42 34 -60 10 -30 L0 -8 L-10 -30 C-34 -60 -84 -42 -98 6 Z" fill="#A9703F" opacity=".55"/>`,
    hairFront: (hair, tilt) => `<g transform="rotate(${hair * .4})"><path d="M-98 -8 C-96 -112 96 -112 98 -8 C84 -56 34 -74 10 -44 L0 -22 L-10 -44 C-34 -74 -84 -56 -98 -8 Z" fill="#B58BF5"/><path d="M-60 -72 C-30 -96 20 -98 50 -80" stroke="#E4CCFF" stroke-width="10" fill="none" stroke-linecap="round"/></g>
      <g transform="rotate(${-tilt * 1.5 + hair * 2} -90 34)"><circle cx="-90" cy="52" r="15" fill="none" stroke="#FFD45C" stroke-width="6"/></g><g transform="rotate(${-tilt * 1.5 + hair * 2} 90 34)"><circle cx="90" cy="52" r="15" fill="none" stroke="#FFD45C" stroke-width="6"/></g>`,
  };
  /* ---------- Bimo: tamu heboh, keriting oranye, kacamata bulat, kaos biru ---------- */
  const CURLS = [[-72, -42, 28], [-52, -78, 30], [-16, -98, 30], [22, -98, 30], [56, -78, 30], [74, -42, 28], [-30, -58, 26], [10, -64, 28], [44, -52, 24]];
  const curls = (dx, dy, f, k) => CURLS.map(([a, b, r], i) => `<circle cx="${a + dx}" cy="${b + dy + Math.sin(i * 1.7) * k}" r="${r}" fill="${f}"/>`).join('');
  const BIMO = {
    skin: '#8D5A3B', sk2: '#6E4229', col: '#3B4CCA', col2: '#27348F', w: 172, rx: 60, r: 82, armLen: 165, pants: '#173336', ink: '#1E1A19', eyeR: 9,
    shoe: `<path d="M-30 196 H30 Q46 196 46 212 V222 H-30 Z" fill="#FCF5EB"/><path d="M-30 190 H18 Q40 190 42 208 H-30 Z" fill="#FD5B35"/>`,
    deco: `<path d="M-34 96 Q0 122 34 96" stroke="#27348F" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    headShade: `<path d="M-90 4 C-86 -40 86 -40 90 4 L90 -90 L-90 -90Z" fill="#6E4229" opacity=".55"/>`,
    hairFront: hair => `<path d="M-84 -10 C-86 -60 -60 -70 -50 -60 L50 -60 C60 -70 86 -60 84 -10 Z" fill="#3A2A22"/><g transform="translate(0,${-Math.abs(hair) * .8})">${curls(5, 6, '#D9853F', hair)}${curls(0, 0, '#F4A259', hair)}<g fill="#FFD08A"><circle cx="-20" cy="-108" r="10"/><circle cx="30" cy="-104" r="8"/><circle cx="-60" cy="-88" r="8"/><circle cx="62" cy="-70" r="7"/></g></g><circle cx="82" cy="40" r="6" fill="#E8E8E8"/>`,
    extra: () => `<g stroke="#1E1A19" stroke-width="6" fill="#fff" fill-opacity=".16"><circle cx="-30" cy="6" r="25"/><circle cx="30" cy="6" r="25"/><line x1="-5" y1="4" x2="5" y2="4"/></g><path d="M-46 -8 Q-36 -16 -24 -14 M16 -14 Q28 -16 40 -8" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>`,
  };
  /* ---------- Bos Jaka: pemilik, jambul beruban, kumis, kemeja oranye motif daun ---------- */
  const LEAVES = [[-74, 150], [36, 140], [-22, 212], [68, 232], [-80, 288], [8, 306]].map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx="21" ry="10" transform="rotate(-30 ${a} ${b})" fill="#FFD45C"/>`).join('');
  const JAKA = {
    skin: '#E0A776', sk2: '#BF8452', col: '#FD5B35', col2: '#C9401E', w: 248, rx: 78, r: 92, armLen: 150, pants: '#5B4636', mouthY: 10,
    shoe: `<path d="M-32 208 H40 Q48 208 48 216 V222 H-32 Z" fill="#2B2321"/><path d="M-14 208 Q4 184 30 208" stroke="#2B2321" stroke-width="9" fill="none"/><ellipse cx="6" cy="206" rx="26" ry="9" fill="#E0A776"/>`,
    deco: `${LEAVES}<path d="M-38 94 L0 138 L38 94" fill="#fff"/>`,
    headShade: `<path d="M-96 2 C-88 -46 60 -70 96 2 L96 -100 L-96 -100Z" fill="#BF8452" opacity=".5"/>`,
    hairFront: hair => `<g transform="rotate(${hair * 1.4} 0 -60)"><path d="M-98 -4 C-116 -110 -36 -178 52 -164 C128 -150 136 -70 98 -4 C94 -52 66 -70 30 -72 C-10 -76 -62 -66 -82 -38 Z" fill="#2B2321"/><path d="M0 -150 C40 -146 84 -122 96 -84" stroke="#D9D9D9" stroke-width="12" fill="none" stroke-linecap="round"/></g>`,
    extra: o => `<g transform="rotate(${o.kumis || 0} 0 30)"><path d="M-40 30 Q-20 18 0 26 Q20 18 40 30 Q20 40 0 34 Q-20 40 -40 30 Z" fill="#2B2321"/></g>`,
  };
  T.rara = (x, y, s, o = {}) => build(RARA, x, y, s, o);
  T.bimo = (x, y, s, o = {}) => build(BIMO, x, y, s, o);
  T.jaka = (x, y, s, o = {}) => build(JAKA, x, y, s, o);
  T.KAKI = 552; // jarak tengah kepala ke telapak kaki (sebelum skala)

  /* gerak dasar supaya tokoh tidak pernah diam total */
  T.hidup = (t, seed, o = {}) => {
    const w = tt => H.wiggle(tt, .6, 2.5, seed) + Math.sin(tt * 1.3 + seed) * 1.5;
    return Object.assign({}, o, {
      tilt: (o.tilt || 0) + w(t),
      dy: (o.dy || 0) + H.breath(t + seed * 1.7, 3),
      hair: (o.hair || 0) - H.drag(w, t, .14, 1.2) * .8,
      kumis: (o.kumis || 0) + H.wiggle(t, 1.2, 2, seed + 4),
      face: Object.assign({ blink: H.blink(t, seed) }, o.face || {}),
    });
  };
  // siklus jalan: gabungkan ke opsi.  Object.assign(opsi, T.jalan(t, 12))
  T.jalan = (t, rate = 12) => { const s = Math.sin(t * rate); return { legL: s * 20, legR: -s * 20, armL: 12 - s * 22, armR: -12 - s * 22, dy: -Math.abs(s) * 10, hair: Math.abs(Math.sin(t * rate - .6)) * 5 }; };
  // mulut bicara: T.bicara(t) -> {mouth:'open', open:0..1}
  T.bicara = (t, seed = 0) => ({ mouth: 'open', open: .25 + .75 * Math.abs(Math.sin(t * 11 + seed) * Math.sin(t * 4.3 + seed)) });

  /* ---------- benda di tangan (ang = sudut lengan, supaya benda tetap tegak) ---------- */
  T.kunci = (ang, no = '02') => `<g transform="translate(0,34) rotate(${-ang})"><circle r="17" fill="none" stroke="#FFD45C" stroke-width="8"/><rect x="-4" y="15" width="8" height="46" fill="#FFD45C"/><rect x="4" y="44" width="15" height="8" fill="#FFD45C"/><rect x="-22" y="-52" width="44" height="32" rx="8" fill="#FD5B35"/><text x="0" y="-29" text-anchor="middle" font-family="P" font-weight="700" font-size="20" fill="#fff">${no}</text></g>`;
  T.cangkir = (ang, t = 0) => `<g transform="rotate(${-ang}) translate(0,-34)"><path d="M-12 -52 Q-4 ${-66 - Math.sin(t * 3) * 4} -12 -82 M10 -52 Q18 ${-66 + Math.sin(t * 3) * 4} 10 -82" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".75"/><rect x="-30" y="-40" width="60" height="68" rx="10" fill="#FCF5EB"/><path d="M30 -24 Q56 -20 52 0 Q48 16 30 14" fill="none" stroke="#FCF5EB" stroke-width="9"/><rect x="-30" y="-8" width="60" height="12" fill="#15787D"/></g>`;
  T.koper = (x, y, r = 0) => `<g transform="translate(${x},${y})"><ellipse cx="0" cy="136" rx="70" ry="12" fill="#173336" opacity=".2"/><g transform="rotate(${r} 0 134)"><rect x="-14" y="-110" width="28" height="116" rx="8" fill="none" stroke="#173336" stroke-width="8"/><rect x="-52" y="0" width="104" height="128" rx="16" fill="#FD5B35"/><rect x="14" y="0" width="38" height="128" rx="16" fill="#C9401E" opacity=".5"/><line x1="-52" y1="42" x2="52" y2="42" stroke="#fff" stroke-width="6" opacity=".5"/><line x1="-52" y1="86" x2="52" y2="86" stroke="#fff" stroke-width="6" opacity=".5"/><circle cx="-30" cy="134" r="10" fill="#173336"/><circle cx="30" cy="134" r="10" fill="#173336"/></g></g>`;


  /* ---------- Pak Acong: tokoh yang SUDAH TAYANG (IG "Acong vs Bos Jaka"). Jangan ubah ciri dan sifatnya. ----------
   * Ciri: rambut hitam pendek rata, kacamata bulat tebal, kulit sawo matang, jubah panjang abu-kecokelatan
   *       berbintik putih sampai lantai (kaki tidak terlihat), memegang nota kertas.
   * Sifat: pemilik penginapan yang masih serba kertas; mudah panik, terburu-buru, gampang jengkel.
   * Wajah bawaan: mata garis + mulut bergelombang. Saat jengkel pakai T.mendung() di atas kepalanya. */
  const SPOTS = [[-40, 196, 9], [44, 184, 7], [18, 250, 8], [-14, 318, 10], [-62, 352, 7], [50, 380, 8], [-30, 440, 7], [30, 478, 9]].map(([a, b, r]) => `<ellipse cx="${a}" cy="${b}" rx="${r}" ry="${r * .8}" fill="#EDE6DA"/>`).join('');
  const ACONG = {
    skin: '#D9955B', sk2: '#B87840', col: '#7A6F63', col2: '#5A5148', w: 204, rx: 30, r: 84, armLen: 150, ink: '#1D1B26', eyeR: 9,
    body: () => `<path d="M-64 548 h44 q10 0 10 8 h-54Z M20 548 h44 v8 h-54 q0 -8 10 -8Z" fill="#3A2A22"/>
      <path d="M-96 110 Q-96 92 -78 92 H78 Q96 92 96 110 L128 528 Q130 548 110 548 H-110 Q-130 548 -128 528 Z" fill="#7A6F63"/>
      <path d="M30 92 H78 Q96 92 96 110 L128 528 Q130 548 110 548 H44 Z" fill="#5A5148" opacity=".4"/>
      <path d="M-99 158 H99" stroke="#5A5148" stroke-width="7"/>${SPOTS}`,
    deco: `<path d="M-26 92 Q0 112 26 92" stroke="#5A5148" stroke-width="7" fill="none"/>`,
    headShade: `<path d="M-90 -6 C-80 -34 80 -34 90 -6 L90 -100 L-90 -100Z" fill="#B87840" opacity=".5"/>`,
    hairFront: hair => `<g transform="rotate(${hair * .3} 0 -50)"><path d="M-70 -46 C-78 -96 -52 -108 0 -108 C52 -108 78 -96 70 -46 Z" fill="#1D1B26"/><path d="M-66 -62 H66 L68 -46 H-68Z" fill="#2E2B3A"/><path d="M-44 -94 C-20 -102 20 -102 44 -94" stroke="#3A3748" stroke-width="7" fill="none" stroke-linecap="round"/></g>`,
    extra: () => `<g stroke="#1D1B26" stroke-width="8" fill="#fff" fill-opacity=".18"><circle cx="-30" cy="6" r="25"/><circle cx="30" cy="6" r="25"/><line x1="-5" y1="4" x2="5" y2="4"/></g>`,
  };
  /* ---------- Bu Yanti: tamu yang kurang akrab dengan HP (cepol beruban, kacamata baca melorot, blus bunga) ----------
   * Gapteknya ditunjukkan lewat cara memegang HP: dijauhkan, mengetik satu jari, memicingkan mata. */
  const DOTS = [[-70, 150], [-10, 176], [56, 150], [-52, 232], [20, 250], [78, 222], [-84, 300], [-14, 318], [58, 302]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="9" fill="#FFD45C"/><circle cx="${a}" cy="${b}" r="3.5" fill="#FD5B35"/>`).join('');
  const YANTI = {
    skin: '#D9A074', sk2: '#B67C50', col: '#A8477A', col2: '#7C2F58', w: 232, rx: 78, r: 88, armLen: 145, pants: '#3B3F66',
    shoe: `<path d="M-30 204 H36 Q48 204 48 214 V222 H-30 Z" fill="#FCF5EB"/><path d="M-30 198 H20 Q36 198 40 208 H-30 Z" fill="#E9DCC8"/>`,
    hairBack: `<circle cx="0" cy="-104" r="40" fill="#3A2A22"/><path d="M-22 -128 C-6 -140 16 -138 28 -124" stroke="#BDBDBD" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="-30" y="-78" width="60" height="12" rx="6" fill="#FD5B35"/>`,
    deco: `${DOTS}<path d="M-40 92 Q0 132 40 92" fill="#D9A074"/><path d="M-40 92 Q0 132 40 92" stroke="#7C2F58" stroke-width="7" fill="none"/>`,
    headShade: `<path d="M-92 6 C-84 -40 84 -40 92 6 L92 -100 L-92 -100Z" fill="#B67C50" opacity=".5"/>`,
    hairFront: hair => `<g transform="rotate(${hair * .3})"><path d="M-92 -4 C-98 -104 98 -104 92 -4 C80 -50 44 -72 0 -72 C-44 -72 -80 -50 -92 -4Z" fill="#3A2A22"/><path d="M-70 -50 C-46 -80 -10 -90 20 -88" stroke="#BDBDBD" stroke-width="9" fill="none" stroke-linecap="round"/></g><circle cx="-88" cy="38" r="8" fill="#FCF5EB"/><circle cx="88" cy="38" r="8" fill="#FCF5EB"/>`,
    // kacamata baca: o.kacamata = seberapa melorot (0..1)
    extra: o => { const d = (o.kacamata === undefined ? .6 : o.kacamata) * 14; return `<g transform="translate(0,${8 + d})"><path d="M-58 4 Q-84 30 -70 78 M58 4 Q84 30 70 78" stroke="#FFD45C" stroke-width="4" fill="none" stroke-dasharray="3 7" stroke-linecap="round"/><g fill="#fff" fill-opacity=".22" stroke="#15787D" stroke-width="6"><rect x="-56" y="-12" width="44" height="28" rx="10"/><rect x="12" y="-12" width="44" height="28" rx="10"/></g><path d="M-12 0 Q0 -8 12 0" stroke="#15787D" stroke-width="6" fill="none"/></g>`; },
  };
  T.acong = (x, y, s, o = {}) => build(ACONG, x, y, s, Object.assign({}, o, { face: Object.assign({ eye: 'line', mouth: 'wavy' }, o.face || {}) }));
  T.yanti = (x, y, s, o = {}) => build(YANTI, x, y, s, o);

  /* benda tambahan */
  // buku catatan tebal (untuk Acong). buka: 0 tertutup .. 1 terbuka
  T.buku = (ang, buka = 1) => `<g transform="rotate(${-ang}) translate(0,-30)"><rect x="${-44 - 40 * buka}" y="-56" width="${88 + 80 * buka}" height="104" rx="8" fill="#5B4636"/><rect x="${-38 - 40 * buka}" y="-50" width="${76 + 80 * buka}" height="92" rx="5" fill="#FCF5EB"/>${buka > .5 ? `<line x1="0" y1="-50" x2="0" y2="42" stroke="#CFC5B5" stroke-width="4"/>${[-30, -12, 6, 24].map(y => `<path d="M-68 ${y} H-12 M12 ${y} H${y > 0 ? 44 : 68}" stroke="#9AA" stroke-width="5" stroke-linecap="round"/>`).join('')}<path d="M18 26 L60 -22" stroke="#FD5B35" stroke-width="6" stroke-linecap="round"/>` : `<rect x="-22" y="-30" width="44" height="22" rx="4" fill="#FFD45C"/>`}</g>`;
  // HP di tangan. layar: 'chat' | 'kalender' | 'ok' | 'bingung'
  T.hp = (ang, layar = 'kalender') => {
    const scr = layar === 'chat' ? `<rect x="-30" y="-58" width="50" height="14" rx="7" fill="#15787D"/><rect x="-20" y="-36" width="50" height="14" rx="7" fill="#ccc"/><rect x="-30" y="-14" width="44" height="14" rx="7" fill="#15787D"/>`
      : layar === 'ok' ? `<circle cx="0" cy="-28" r="26" fill="#2DBE78"/><path d="M-12 -28 L-3 -18 L13 -38" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        : layar === 'bingung' ? `<text x="0" y="-12" text-anchor="middle" font-family="P" font-weight="700" font-size="54" fill="#FD5B35">?</text>`
          : `<rect x="-32" y="-60" width="64" height="16" rx="4" fill="#e9dcc8"/><rect x="-32" y="-38" width="64" height="16" rx="4" fill="#2DBE78"/><rect x="-32" y="-16" width="64" height="16" rx="4" fill="#e9dcc8"/>`;
    return `<g transform="rotate(${-ang}) translate(0,-24)"><rect x="-46" y="-90" width="92" height="160" rx="16" fill="#16202A"/><rect x="-36" y="-76" width="72" height="126" rx="8" fill="#fff"/><g transform="translate(0,10)">${scr}</g></g>`;
  };
  // nota kertas (benda khas Pak Acong)
  T.nota = (ang, goyang = 0) => `<g transform="rotate(${-ang + goyang}) translate(0,-34)"><rect x="-34" y="-50" width="68" height="92" rx="5" fill="#FCF5EB" stroke="#CFC5B5" stroke-width="3"/><path d="M-22 -30 H22 M-22 -12 H22 M-22 6 H10 M-22 24 H18" stroke="#9AA" stroke-width="5" stroke-linecap="round"/></g>`;
  // awan mendung + petir di atas kepala (tanda jengkel Pak Acong). k = 0..1 muncul
  T.mendung = (x, y, t, k = 1) => `<g transform="translate(${x + Math.sin(t * 3) * 6},${y + Math.sin(t * 5) * 4}) scale(${k})" opacity="${Math.min(1, k * 1.5)}"><g fill="#4A4F5C"><ellipse cx="-40" cy="0" rx="46" ry="30"/><ellipse cx="10" cy="-16" rx="54" ry="38"/><ellipse cx="54" cy="4" rx="40" ry="26"/><rect x="-70" y="0" width="150" height="28" rx="14"/></g><ellipse cx="0" cy="-26" rx="30" ry="12" fill="#6B7180"/>${Math.sin(t * 9) > .2 ? `<path d="M6 30 L-14 66 H4 L-8 100 L30 56 H10 L22 30Z" fill="#FFD45C"/>` : ''}</g>`;
  T.tas = ang => `<g transform="rotate(${-ang}) translate(0,10)"><path d="M-26 0 Q-26 -44 0 -44 Q26 -44 26 0" stroke="#5B4636" stroke-width="8" fill="none"/><path d="M-50 0 H50 L42 96 H-42Z" fill="#E9DCC8"/><path d="M-46 30 H46" stroke="#15787D" stroke-width="10"/></g>`;
  window.T = T;
})();
