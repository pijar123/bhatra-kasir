// Tema tampilan toko. Dipakai halaman toko (terapkan), dashboard & pusat (pilihan + pratinjau).
window.THEMES = {
  hangat: { name: 'Hangat', note: 'Merah-krem ceria', font: 'ceria', pattern: 'titik',
    v: { red: '#C8372D', 'red-d': '#A82A21', gold: '#F2B33D', butter: '#FFE9A8', pink: '#FFE1DC', ink: '#3A1E12', muted: '#7A5E4F', cream: '#FFF7EC', card: '#FFFFFF', line: '#F0DEC6', r: '22px' } },
  segar: { name: 'Segar', note: 'Hijau, cocok sayur & jamu', font: 'bulat', pattern: 'titik',
    v: { red: '#2E8B57', 'red-d': '#22704A', gold: '#F5C542', butter: '#E3F3D6', pink: '#FDF0D5', ink: '#1F3324', muted: '#5B6E5F', cream: '#F6FBF2', card: '#FFFFFF', line: '#D6E9CB', r: '20px' } },
  kopi: { name: 'Kopi', note: 'Cokelat hangat & klasik', font: 'klasik', pattern: 'polos',
    v: { red: '#8B5A2B', 'red-d': '#6E4520', gold: '#D9A55B', butter: '#F1E2CC', pink: '#F6E7DA', ink: '#2B1B10', muted: '#6F5A4A', cream: '#FAF4EC', card: '#FFFFFF', line: '#E7D7C1', r: '14px' } },
  manis: { name: 'Manis', note: 'Pink, cocok kue & dessert', font: 'santai', pattern: 'titik',
    v: { red: '#D6457A', 'red-d': '#B23462', gold: '#FFC857', butter: '#FFE3EE', pink: '#FFF0D9', ink: '#3D1F2B', muted: '#7D5A68', cream: '#FFF7FA', card: '#FFFFFF', line: '#F6D9E4', r: '26px' } },
  laut: { name: 'Laut', note: 'Biru bersih, seafood & minuman', font: 'rapi', pattern: 'kotak',
    v: { red: '#1F6FB2', 'red-d': '#175891', gold: '#FFB547', butter: '#DCEBFA', pink: '#FFE9D6', ink: '#14263A', muted: '#546A80', cream: '#F5F9FD', card: '#FFFFFF', line: '#D6E4F2', r: '18px' } },
  pedas: { name: 'Pedas', note: 'Oranye menyala, seblak & geprek', font: 'ceria', pattern: 'kotak',
    v: { red: '#E8501C', 'red-d': '#C23E10', gold: '#FFC700', butter: '#FFE7B8', pink: '#FFDCCB', ink: '#2A1408', muted: '#7A5440', cream: '#FFF6EA', card: '#FFFFFF', line: '#F5D9BF', r: '16px' } },
  malam: { name: 'Malam', note: 'Gelap elegan', font: 'rapi', pattern: 'polos',
    v: { red: '#FF7A45', 'red-d': '#E8622E', gold: '#FFC24B', butter: '#2A2420', pink: '#3A2622', ink: '#F5EDE6', muted: '#B8A99C', cream: '#171311', card: '#221C19', line: '#3A302A', r: '18px' } },
  polos: { name: 'Polos', note: 'Hitam-putih minimalis', font: 'rapi', pattern: 'polos',
    v: { red: '#1A1A1A', 'red-d': '#000000', gold: '#E9E4DA', butter: '#F3F1EC', pink: '#F3F1EC', ink: '#1A1A1A', muted: '#666666', cream: '#FFFFFF', card: '#FFFFFF', line: '#E6E6E6', r: '12px' } },
};
window.FONTS = {
  ceria: { name: 'Ceria', d: 'Bricolage Grotesque', b: 'Plus Jakarta Sans', q: 'Bricolage+Grotesque:opsz,wght@12..96,800&family=Plus+Jakarta+Sans:wght@500;600;700;800' },
  bulat: { name: 'Bulat', d: 'Baloo 2', b: 'Nunito', q: 'Baloo+2:wght@700;800&family=Nunito:wght@500;600;700;800' },
  klasik: { name: 'Klasik', d: 'Fraunces', b: 'Plus Jakarta Sans', q: 'Fraunces:opsz,wght@9..144,700;9..144,800&family=Plus+Jakarta+Sans:wght@500;600;700;800' },
  santai: { name: 'Santai', d: 'Fredoka', b: 'Nunito', q: 'Fredoka:wght@600;700&family=Nunito:wght@500;600;700;800' },
  rapi: { name: 'Rapi', d: 'DM Sans', b: 'DM Sans', q: 'DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700;9..40,800' },
};
window.PATTERNS = { titik: 'Titik', kotak: 'Kotak', polos: 'Polos' };

(function () {
const HEX = /^#[0-9a-fA-F]{6}$/;
const mix = (hex, to, t) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return '#' + [16, 8, 0].map(c).map(x => x.toString(16).padStart(2, '0')).join(''); };

// Gabungkan pilihan pemilik dengan preset: hasil {vars, font, pattern}.
window.resolveTheme = function (theme) {
  theme = theme || {};
  const p = THEMES[theme.preset] || THEMES.hangat, v = { ...p.v };
  if (HEX.test(theme.primary || '')) {
    v.red = theme.primary; v['red-d'] = mix(theme.primary, '#000000', 0.18);
    v.butter = p === THEMES.malam ? mix(theme.primary, p.v.cream, 0.82) : mix(theme.primary, '#FFFFFF', 0.82);
  }
  return { vars: v, font: FONTS[theme.font] ? theme.font : p.font, pattern: PATTERNS[theme.pattern] ? theme.pattern : p.pattern };
};

// Terapkan ke elemen (default <html>). design = pengaturan admin pusat (css, hero_img).
window.applyTheme = function (theme, design, el) {
  const r = resolveTheme(theme), root = el || document.documentElement, f = FONTS[r.font];
  Object.entries(r.vars).forEach(([k, val]) => root.style.setProperty('--' + k, val));
  root.style.setProperty('--fd', `'${f.d}',system-ui,sans-serif`); root.style.setProperty('--fb', `'${f.b}',system-ui,sans-serif`);
  root.dataset.pattern = r.pattern; root.dataset.dark = r.vars.cream === THEMES.malam.v.cream ? '1' : '';
  if (!el) {
    let link = document.getElementById('themeFont');
    if (r.font !== 'ceria') { if (!link) { link = document.createElement('link'); link.id = 'themeFont'; link.rel = 'stylesheet'; document.head.appendChild(link); } link.href = `https://fonts.googleapis.com/css2?family=${f.q}&display=swap`; }
    const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = r.vars.red;
    design = design || {};
    let st = document.getElementById('designCss');
    if (!st) { st = document.createElement('style'); st.id = 'designCss'; document.head.appendChild(st); }
    const img = /^https:\/\/[^\s"'()]+$/.test(design.hero_img || '') ? `.hero{background-image:linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.18)),url("${design.hero_img}");background-size:cover;background-position:center}.hero .kicker,.hero .sub{color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.45)}` : '';
    st.textContent = img + (design.css || '');
  }
};
// Muat font semua tema sekaligus (untuk kartu pratinjau di dashboard/pusat).
window.loadAllThemeFonts = function () {
  if (document.getElementById('allThemeFonts')) return;
  const l = document.createElement('link'); l.id = 'allThemeFonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + Object.values(FONTS).map(f => f.q).join('&family=') + '&display=swap';
  document.head.appendChild(l);
};
})();
