const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};
let CATS = ['Paket Nasi', 'Lauk', 'Tambahan', 'Minuman'];
const METHOD = { delivery: 'Antar ke alamat', cod: 'COD (ketemuan)', pickup: 'Ambil di rumah' };
let SEL = {}, MENU = [], SET = null, cart = store.get('bhatra_cart', []);

const jktMin = () => { const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':'); return +h * 60 + +m; };
const toMin = t => { const [h, m] = t.split(':'); return +h * 60 + +m; };
const hm = t => t.slice(0, 5).replace(':', '.');
function state() {
  if (!SET) return { open: false, delivery: false };
  const m = jktMin(), o = toMin(SET.open_time), inWin = (s, e) => s === e || (s < e ? m >= s && m <= e : m >= s || m <= e);
  const open = SET.is_open && inWin(o, toMin(SET.close_time));
  return { open, delivery: open && inWin(toMin(SET.delivery_from || SET.open_time), toMin(SET.delivery_until)), full: SET.open_time === SET.close_time };
}
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 1800); }

/* ---------- toko ---------- */
async function loadShop() {
  const [menu, set] = await Promise.all([
    sb.from('menu_items').select('*').order('sort'),
    sb.from('settings').select('*').eq('id', 1).single()
  ]);
  if (menu.error || set.error) { $('menu').innerHTML = '<p class="err">Menu gagal dimuat. Coba muat ulang halaman.</p>'; return; }
  MENU = menu.data; SET = set.data; if (SET.categories?.length) CATS = SET.categories;
  cart = cart.filter(c => MENU.some(m => m.id === c.id && m.available));
  renderInfo(); renderBanners(); renderMenu(); renderCart(); renderMine();
}
function renderInfo() {
  const s = state(), el = $('openInfo');
  el.className = 'pill ' + (s.open ? 'on' : 'off');
  const df = SET.delivery_from || SET.open_time, dJam = df === SET.delivery_until ? '24 jam' : `${hm(df)}–${hm(SET.delivery_until)}`;
  const base = s.full ? 'Buka 24 jam' : `Buka ${hm(SET.open_time)}–${hm(SET.close_time)}`;
  const rp = 'Rp' + (SET.ongkir_per_km || 1000).toLocaleString('id-ID');
  const dn = $('dlvNote'), cn = $('codNote');
  if (dn) dn.textContent = `Ongkir ${rp}/km${+SET.free_ongkir_min > 0 ? ' · gratis mulai Rp' + (+SET.free_ongkir_min).toLocaleString('id-ID') : ''} · jam ${dJam}`;
  if (cn) cn.textContent = `Titik temu yang disepakati · jam ${dJam}`;
  el.textContent = s.open
    ? (s.delivery ? `${base} · Antar & COD ${dJam}` : `${base} · sekarang ambil di rumah (antar jam ${dJam})`)
    : (s.full || !SET.is_open ? 'Tutup sementara' : `Tutup · buka ${hm(SET.open_time)}–${hm(SET.close_time)} WIB`);
  const fh = $('footHours'); if (fh) fh.textContent = s.full ? 'Buka 24 jam' : `Buka ${hm(SET.open_time)}–${hm(SET.close_time)} WIB`;
}
let bnT = null;
function renderBanners() {
  const box = $('banners'), B = SET.banners || []; clearInterval(bnT);
  if (!box) return; box.hidden = !B.length; if (!B.length) return;
  box.innerHTML = `<div class="track">${B.map((u, i) => `<img src="${esc(u)}" alt="Promo ${i + 1}" width="1200" height="600"${i ? ' loading="lazy"' : ''}>`).join('')}</div>${B.length > 1 ? `<div class="dots" aria-hidden="true">${B.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}`;
  if (B.length < 2) return;
  const tr = box.querySelector('.track'), imgs = [...tr.children], dots = [...box.querySelectorAll('.dots i')];
  const cur = () => Math.round(tr.scrollLeft / (tr.clientWidth + 10));
  tr.addEventListener('scroll', () => { const i = cur(); dots.forEach((d, j) => d.classList.toggle('on', i === j)); }, { passive: true });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let hold = 0; ['touchstart', 'pointerdown'].forEach(ev => tr.addEventListener(ev, () => { hold = Date.now(); }, { passive: true }));
  bnT = setInterval(() => { if (Date.now() - hold < 6000 || document.hidden) return; const n = (cur() + 1) % imgs.length; tr.scrollTo({ left: imgs[n].offsetLeft, behavior: 'smooth' }); }, 4500);
}
async function renderMine() {
  const box = $('mine'); if (!box) return;
  const toks = store.get('bhatra_orders', []).slice(0, 5); if (!toks.length) { box.hidden = true; return; }
  const res = await Promise.all(toks.map(t => sb.rpc('get_order', { p_token: t }).then(r => r.data?.[0], () => null)));
  const R = res.filter(o => o && Date.now() - new Date(o.created_at) < 3 * 864e5), act = R.filter(o => !['selesai', 'batal'].includes(o.status));
  const L = (act.length ? act : R.filter(o => Date.now() - new Date(o.created_at) < 12 * 36e5).slice(0, 1)).slice(0, 3);
  box.hidden = !L.length; if (!L.length) return;
  box.innerHTML = '<h2>Pesanan kamu</h2>' + L.map(o => {
    const on = !['selesai', 'batal'].includes(o.status), tot = o.subtotal + (o.ongkir || 0) + (o.unique_code || 0);
    const t = new Date(o.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return `<a class="mine${on ? ' on' : ''}" href="?o=${esc(o.token)}"><span><b>#${esc(o.code)}</b><small>${t} · ${rp(tot)}</small></span><em>${LABEL[o.status] || esc(o.status)}</em><i aria-hidden="true">›</i></a>`;
  }).join('');
}
const slug = c => 'c-' + c.toLowerCase().replace(/[^a-z0-9]+/g, '-');
function renderMenu() {
  $('cats').innerHTML = CATS.map(c => `<a href="#${slug(c)}">${esc(c)}</a>`).join('');
  $('menu').innerHTML = CATS.map(c => {
    const items = MENU.filter(m => m.category === c);
    return items.length ? `<section class="cat" id="${slug(c)}"><h2>${esc(c)}</h2>${items.map(itemHTML).join('')}</section>` : '';
  }).join('');
  const links = [...document.querySelectorAll('.cats a')];
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-80px 0px -70% 0px' });
  document.querySelectorAll('.cat').forEach(c => io.observe(c));
  links[0]?.classList.add('active');
}
function itemHTML(m) {
  if (m.variants?.length && !SEL[m.id]) SEL[m.id] = m.variants[0];
  const v = m.variants?.length ? `<div class="chips" role="group" aria-label="Pilihan ${esc(m.name)}">${m.variants.map(x => `<button type="button" class="chip" data-var="${m.id}" data-val="${esc(x)}" aria-pressed="${SEL[m.id] === x}">${esc(x)}</button>`).join('')}</div>` : '';
  const n = cart.filter(c => c.id === m.id).reduce((a, c) => a + c.qty, 0);
  const ok = m.available && m.stock !== 0;
  const btn = ok ? `<button class="add" type="button" data-add="${m.id}" aria-label="Tambah ${esc(m.name)}">+<span class="n"${n ? '' : ' hidden'}>${n}</span></button>` : '<span class="habis">Habis</span>';
  const tag = (m.featured ? '<span class="tag">Menu andalan</span> ' : '') + (m.price_before > m.price ? '<span class="tag">Promo</span> ' : '') + (ok && m.stock > 0 && m.stock <= 5 ? `<span class="tag low">Sisa ${m.stock}</span>` : '');
  return `<div class="item${ok ? '' : ' sold'}"><div>${tag}<p class="name">${esc(m.name)}</p>${v}</div><div class="buy"><p class="price">${m.price_before > m.price ? `<s>${rp(m.price_before)}</s>` : ''}${rp(m.price)}${m.unit ? `<small>/${esc(m.unit)}</small>` : ''}</p>${btn}</div></div>`;
}
function addItem(id) {
  const m = MENU.find(x => x.id === id), variant = SEL[id] || '', k = id + '|' + variant;
  if (m.stock != null && cart.filter(c => c.id === id).reduce((a, c) => a + c.qty, 0) >= m.stock) return toast(`Stok ${m.name} tinggal ${m.stock}`);
  const f = cart.find(c => c.k === k); f ? f.qty++ : cart.push({ k, id, variant, qty: 1 });
  saveCart(); toast(`${m.name}${variant ? ' · ' + variant : ''} masuk keranjang`);
}
function lines() { return cart.map(c => { const m = MENU.find(x => x.id === c.id); return m ? { ...c, m, total: m.price * c.qty } : null; }).filter(Boolean); }
function saveCart() { store.set('bhatra_cart', cart); renderCart(); }
function renderCart() {
  const L = lines(), n = L.reduce((a, l) => a + l.qty, 0), t = L.reduce((a, l) => a + l.total, 0);
  $('cartbar').hidden = !n || !$('trackView').hidden;
  $('openCheckout').innerHTML = `<span><span class="count">${n}</span>${rp(t)}</span><span>Lanjut pesan →</span>`;
  document.querySelectorAll('[data-add]').forEach(b => { const k = cart.filter(c => c.id === +b.dataset.add).reduce((a, c) => a + c.qty, 0), el = b.querySelector('.n'); if (el) { el.textContent = k; el.hidden = !k; } });
  $('cartList').innerHTML = L.map(l => `<li><div><p class="name">${esc(l.m.name)}${l.variant ? ` <em>· ${esc(l.variant)}</em>` : ''}</p><p class="muted">${rp(l.m.price)}</p></div>
    <div class="qty"><button type="button" data-q="-1" data-k="${esc(l.k)}" aria-label="Kurangi">−</button><span>${l.qty}</span><button type="button" data-q="1" data-k="${esc(l.k)}" aria-label="Tambah">+</button></div></li>`).join('');
  $('subtotal').innerHTML = VC?.disc ? `<s style="opacity:.55;font-weight:600">${rp(t)}</s> ${rp(Math.max(0, t - VC.disc))}` : rp(t);
  if (VC && VC.sub !== t) checkVoucher(true);
  if (!$('checkout').hidden) renderOngkir();
}
document.addEventListener('click', e => {
  const ch = e.target.closest('[data-var]');
  if (ch) { SEL[ch.dataset.var] = ch.dataset.val; ch.parentElement.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', b === ch)); return; }
  const a = e.target.closest('[data-add]'); if (a) return addItem(+a.dataset.add);
  const q = e.target.closest('[data-q]'); if (!q) return;
  const c = cart.find(x => x.k === q.dataset.k); if (!c) return;
  c.qty += +q.dataset.q; if (c.qty < 1) cart = cart.filter(x => x !== c);
  saveCart(); if (!cart.length) closeSheet();
});

let VC = null;
const cartSub = () => lines().reduce((a, l) => a + l.total, 0);
const freeOngkir = s => +SET.free_ongkir_min > 0 && s >= +SET.free_ongkir_min;
async function checkVoucher(quiet) {
  const inp = $('vcIn'), msg = $('vcMsg'), code = inp.value.trim().toUpperCase(), sub = cartSub();
  if (!code) { VC = null; msg.hidden = true; renderCart(); return; }
  const { data, error } = await sb.rpc('check_voucher', { p_code: code, p_sub: sub });
  if (error || !data?.ok) { VC = null; msg.hidden = false; msg.className = 'err'; msg.textContent = error ? error.message : data.msg; }
  else { VC = { code: data.code, disc: data.disc, sub }; msg.hidden = false; msg.className = 'ok-msg'; msg.textContent = `Hemat ${rp(data.disc)} pakai ${data.code}`; }
  renderCart();
}
/* ---------- checkout ---------- */
function openSheet() {
  const s = state(), f = $('coForm');
  f.querySelectorAll('input[name=method]').forEach(r => { if (r.value !== 'pickup') r.disabled = !s.delivery; });
  if (!s.delivery) f.method.value = 'pickup';
  const saved = store.get('bhatra_me', {}); if (saved.name && !f.name.value) { f.name.value = saved.name; f.phone.value = saved.phone || ''; f.address.value = saved.address || ''; }
  $('etaNote').textContent = `Perkiraan siap ± ${SET.prep_min || 20} menit setelah pesanan diterima.`;
  syncMethod(); $('coErr').hidden = true; $('checkout').hidden = false; document.body.style.overflow = 'hidden';
}
function closeSheet() { $('checkout').hidden = true; document.body.style.overflow = ''; }
function syncMethod() { const pick = $('coForm').method.value === 'pickup'; $('locWrap').hidden = pick; $('ongkirNote').hidden = pick; $('mapBox').hidden = pick || !hasShop(); if (!pick) { ensureMap(); renderOngkir(); } }

/* ---------- peta & ongkir ---------- */
let MAP = null, PIN = null, ROUTE = { km: null, lat: null, lng: null, busy: false };
const hasShop = () => SET && SET.shop_lat != null && SET.shop_lng != null && window.L;
const ongkirOf = km => Math.ceil(km * (SET.ongkir_per_km || 1000) / 500) * 500;
const fmtKm = km => String(km).replace('.', ',');
const outOfRange = () => ROUTE.km != null && +SET.max_km > 0 && ROUTE.km > +SET.max_km;
function hav(a, b, c, d) { const r = x => x * Math.PI / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); }
function ensureMap() {
  if (!hasShop()) return;
  if (MAP) { setTimeout(() => MAP.invalidateSize(), 60); return; }
  MAP = L.map('map', { scrollWheelZoom: false }).setView([SET.shop_lat, SET.shop_lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(MAP);
  L.marker([SET.shop_lat, SET.shop_lng], { icon: L.divIcon({ className: 'shop-pin', html: '<span>BHATRA</span>', iconSize: [76, 28], iconAnchor: [38, 28] }), interactive: false }).addTo(MAP);
  MAP.on('click', e => setPin(e.latlng.lat, e.latlng.lng));
  setTimeout(() => MAP.invalidateSize(), 60);
  const saved = store.get('bhatra_loc', null); if (saved) setPin(saved.lat, saved.lng);
}
function setPin(lat, lng) {
  if (!PIN) { PIN = L.marker([lat, lng], { draggable: true, autoPan: true }).addTo(MAP); PIN.on('dragend', () => { const p = PIN.getLatLng(); setPin(p.lat, p.lng); }); }
  else PIN.setLatLng([lat, lng]);
  const fit = () => { MAP.invalidateSize(); MAP.fitBounds(L.latLngBounds([[lat, lng], [SET.shop_lat, SET.shop_lng]]), { padding: [40, 40], maxZoom: 16 }); };
  fit(); setTimeout(fit, 120);
  store.set('bhatra_loc', { lat, lng }); calcRoute(lat, lng);
}
async function calcRoute(lat, lng) {
  ROUTE = { km: null, lat, lng, busy: true }; renderOngkir();
  let km = hav(SET.shop_lat, SET.shop_lng, lat, lng) * 1.3;
  try { const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${SET.shop_lng},${SET.shop_lat};${lng},${lat}?overview=false`)).json(); if (j.routes?.[0]) km = Math.max(j.routes[0].distance / 1000, hav(SET.shop_lat, SET.shop_lng, lat, lng)); } catch {}
  if (ROUTE.lat !== lat || ROUTE.lng !== lng) return;
  ROUTE = { km: Math.max(0.1, Math.ceil(km * 10) / 10), lat, lng, busy: false }; renderOngkir();
}
function renderOngkir() {
  const el = $('ongkirNote'); if (!el || !SET) return;
  if (!hasShop()) { el.textContent = 'Ongkir dihitung dari titik lokasi yang kamu kirim lewat WA setelah memesan.'; return; }
  const sub = Math.max(0, cartSub() - (VC?.disc || 0)), fee = ROUTE.km == null ? 0 : freeOngkir(sub) ? 0 : ongkirOf(ROUTE.km);
  el.classList.toggle('warn', outOfRange());
  if (ROUTE.busy) el.textContent = 'Menghitung jarak…';
  else if (ROUTE.km == null) el.textContent = 'Tekan "Pakai lokasi saya" atau tap peta untuk menghitung ongkir.';
  else if (outOfRange()) el.textContent = `Jarak ±${fmtKm(ROUTE.km)} km, di luar jangkauan antar (maks ${fmtKm(+SET.max_km)} km). Pilih Ambil di rumah ya.`;
  else el.innerHTML = `Jarak ±<b>${fmtKm(ROUTE.km)} km</b> · Ongkir <b>${fee ? rp(fee) : 'GRATIS'}</b><br>Total bayar <b>${rp(sub + fee)}</b>`;
}
$('locBtn').onclick = () => {
  const b = $('locBtn'); if (!navigator.geolocation) return toast('HP ini tidak mendukung lokasi. Tap peta saja ya.');
  b.disabled = true; b.lastChild.textContent = 'Mencari lokasi…';
  navigator.geolocation.getCurrentPosition(p => { b.disabled = false; b.lastChild.textContent = 'Pakai lokasi saya'; setPin(p.coords.latitude, p.coords.longitude); },
    () => { b.disabled = false; b.lastChild.textContent = 'Pakai lokasi saya'; toast('Lokasi tidak diizinkan. Tap peta untuk pilih titik.'); }, { enableHighAccuracy: true, timeout: 12000 });
};
$('openCheckout').onclick = openSheet;
$('closeCheckout').onclick = closeSheet;
$('checkout').addEventListener('click', e => { if (e.target.id === 'checkout') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('checkout').hidden) closeSheet(); });
$('coForm').addEventListener('change', e => { if (e.target.name === 'method') syncMethod(); });
$('vcBtn').onclick = () => checkVoucher(false);
$('vcIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkVoucher(false); } });
$('coForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $('coErr'), btn = $('coSubmit');
  const p = { name: f.name.value.trim(), phone: f.phone.value.trim(), method: f.method.value, payment: f.payment.value,
    address: f.method.value === 'pickup' ? '' : f.address.value.trim(), note: f.note.value.trim(),
    ...(f.method.value !== 'pickup' && ROUTE.km != null ? { lat: ROUTE.lat, lng: ROUTE.lng, km: ROUTE.km } : {}),
    items: cart.map(c => ({ id: c.id, variant: c.variant, qty: c.qty })), voucher: VC?.code || '' };
  const bad = !p.name ? 'Nama belum diisi' : !/^(\+?62|0)8\d{7,12}$/.test(p.phone.replace(/[\s-]/g, '')) ? 'Nomor WA belum benar (contoh 0812xxxxxxx)' : (p.method !== 'pickup' && hasShop() && ROUTE.km == null) ? 'Tentukan titik antar di peta dulu ya' : (p.method !== 'pickup' && outOfRange()) ? 'Lokasi di luar jangkauan antar. Pilih Ambil di rumah ya.' : (p.method !== 'pickup' && !p.address) ? 'Detail alamat / patokan belum diisi' : '';
  if (bad) { err.textContent = bad; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Mengirim…'; err.hidden = true;
  const { data, error } = await sb.rpc('place_order', { p });
  btn.disabled = false; btn.textContent = 'Kirim pesanan';
  if (error) { err.textContent = error.message; err.hidden = false; loadShop(); return; }
  const { order_token } = data[0];
  store.set('bhatra_me', { name: p.name, phone: p.phone, address: p.address });
  store.set('bhatra_orders', [order_token, ...store.get('bhatra_orders', [])].slice(0, 10));
  store.set('bhatra_wa_' + order_token, false);
  cart = []; VC = null; $('vcIn').value = ''; $('vcMsg').hidden = true; saveCart(); closeSheet();
  history.pushState(null, '', '?o=' + order_token); route();
});

/* ---------- lacak pesanan ---------- */
let pollT = null;
const STEPS = { delivery: ['baru', 'dimasak', 'diantar', 'selesai'], cod: ['baru', 'dimasak', 'diantar', 'selesai'], pickup: ['baru', 'dimasak', 'siap', 'selesai'] };
const LABEL = { baru: 'Diterima', dimasak: 'Dimasak', diantar: 'Diantar', siap: 'Siap diambil', selesai: 'Selesai', batal: 'Dibatalkan' };
function waText(o, total) {
  const items = o.items.map(i => `- ${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''}`).join('\n');
  return `Halo Warung Jajan BHATRA, saya pesan #${o.code}\n${items}${o.discount ? `\nDiskon ${o.voucher || ''}: -${rp(o.discount)}` : ''}\nSubtotal: ${rp(o.subtotal)}\n${METHOD[o.method]} · Bayar ${o.payment.toUpperCase()}\nNama: ${o.name}${o.address ? '\nAlamat: ' + o.address : ''}${o.note ? '\nCatatan: ' + o.note : ''}\n\n${o.distance_km != null ? '\nJarak: ' + fmtKm(o.distance_km) + ' km · Ongkir ' + rp(o.ongkir) + '\nTotal: ' + rp(total) : ''}${o.maps_link ? '\nLokasi: ' + o.maps_link : ''}\n\nStatus: ${CONFIG.SITE}/?o=${o.token}${o.method !== 'pickup' && !o.maps_link ? '\n\nSaya kirim titik lokasi setelah pesan ini ya.' : ''}`;
}
async function loadOrder(token) {
  const { data, error } = await sb.rpc('get_order', { p_token: token });
  const v = $('trackView');
  if (error || !data?.length) { v.innerHTML = `<div class="card" style="margin-top:24px"><h2>Pesanan tidak ditemukan</h2><p class="muted">Link mungkin salah.</p><a class="btn btn-red" style="margin-top:16px" href="./">Kembali ke menu</a></div>`; return; }
  const o = data[0], steps = STEPS[o.method], idx = steps.indexOf(o.status);
  const needOngkir = o.method !== 'pickup' && o.distance_km == null, total = o.subtotal + (o.ongkir || 0) + (o.unique_code || 0);
  const sentWA = store.get('bhatra_wa_' + token, true);
  const showQR = o.payment === 'qris' && !o.paid && !needOngkir && o.status !== 'batal';
  v.innerHTML = `
  <header class="hero"><div class="logo" data-svg="img/logo.svg" role="img" aria-label="Warung Jajan BHATRA" style="width:150px"></div></header>
  <div class="card">
    <p class="muted">Pesanan</p><h2 style="font-size:32px">#${esc(o.code)}</h2>
    ${o.status === 'batal' ? '<p class="err" style="margin-top:12px">Pesanan dibatalkan. Hubungi WA warung untuk info.</p>'
      : `<div class="steps" role="list">${steps.map((s, i) => `<div role="listitem" class="${i <= idx ? 'done' : ''}">${LABEL[s]}</div>`).join('')}</div>`}
    ${etaHTML(o)}
    ${!sentWA ? `<a class="btn btn-wa" id="waBtn" target="_blank" rel="noopener" href="https://wa.me/${CONFIG.WA}?text=${encodeURIComponent(waText(o, total))}">Kirim pesanan ke WhatsApp</a>
      <p class="muted" style="font-size:14px;margin-top:8px">Wajib agar warung langsung tahu${o.method !== 'pickup' ? ', lalu kirim titik lokasi (Share Location)' : ''}.</p>` : ''}
    <ul class="list" style="margin-top:12px">${o.items.map(i => `<li><span>${i.qty}× ${esc(i.name)}${i.variant ? ` <em>· ${esc(i.variant)}</em>` : ''}</span><span>${rp(i.price * i.qty)}</span></li>`).join('')}</ul>
    ${o.discount ? `<div class="row"><span>Diskon${o.voucher ? ' ' + esc(o.voucher) : ''}</span><span>−${rp(o.discount)}</span></div>` : ''}
    <div class="row"><span>Subtotal</span><span>${rp(o.subtotal)}</span></div>
    ${o.method !== 'pickup' ? `<div class="row"><span>Ongkir${o.distance_km != null ? ` (${o.distance_km} km)` : ''}</span><span>${needOngkir ? 'menunggu' : rp(o.ongkir)}</span></div>` : ''}
    ${o.unique_code ? `<div class="row"><span>Kode unik QRIS</span><span>${rp(o.unique_code)}</span></div>` : ''}
    <div class="row total"><span>Total</span><span>${needOngkir ? rp(o.subtotal) + ' + ongkir' : rp(total)}</span></div>
    <p class="muted" style="margin-top:8px">${METHOD[o.method]} · Bayar ${o.payment === 'qris' ? 'QRIS' : 'tunai'}${o.paid ? ' · <b style="color:var(--ok)">Lunas</b>' : ''}</p>
    ${needOngkir ? '<p class="note" style="margin-top:12px">Ongkir dihitung setelah warung menerima titik lokasi kamu. Halaman ini otomatis ter-update.</p>' : ''}
    ${showQR ? `<h3 style="margin-top:16px">Scan untuk bayar ${rp(total)}</h3><div class="qr" id="qr" role="img" aria-label="QRIS pembayaran ${rp(total)}"></div><p class="muted" style="font-size:14px">Nominal sudah terisi otomatis (termasuk kode unik). Status berubah <b>Lunas</b> sendiri beberapa saat setelah bayar.</p>` : ''}
  </div>
  <button type="button" class="btn btn-ghost" style="margin:16px 0 8px" data-reorder>Pesan lagi yang sama</button><a class="btn btn-ghost" style="margin:0 0 16px" href="./">Lihat menu</a>`;
  v.querySelector('[data-reorder]').onclick = () => reorder(o);
  if (showQR && window.QRCode) new QRCode($('qr'), { text: qrisDynamic(total), width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
  const wb = $('waBtn'); if (wb) wb.onclick = () => { store.set('bhatra_wa_' + token, true); setTimeout(() => loadOrder(token), 500); };
  clearTimeout(pollT); if (!['selesai', 'batal'].includes(o.status)) pollT = setTimeout(() => loadOrder(token), 15000);
}
function etaHTML(o) {
  if (!['baru', 'dimasak', 'diantar'].includes(o.status)) return '';
  const pick = o.method === 'pickup', min = (+SET?.prep_min || 20) + (pick ? 0 : Math.ceil((+o.distance_km || 2) * 3) + 5);
  const t = new Date(new Date(o.created_at).getTime() + min * 6e4);
  return `<p class="eta">${pick ? 'Perkiraan siap diambil' : 'Perkiraan sampai'} ${t < Date.now() ? '<b>sebentar lagi</b>' : `sekitar jam <b>${t.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })}</b>`}</p>`;
}
function reorder(o) {
  let added = 0, miss = 0;
  for (const i of o.items) {
    const m = MENU.find(x => x.id === i.id); if (!m || !m.available || m.stock === 0) { miss++; continue; }
    const variant = m.variants?.length ? (m.variants.includes(i.variant) ? i.variant : m.variants[0]) : '', k = m.id + '|' + variant;
    const f = cart.find(c => c.k === k); f ? f.qty += i.qty : cart.push({ k, id: m.id, variant, qty: i.qty }); added++;
  }
  history.pushState(null, '', './'); route(); saveCart();
  toast(!added ? 'Menunya sedang habis semua' : miss ? `${added} menu masuk keranjang, ${miss} sedang habis` : 'Pesanan yang sama sudah di keranjang');
  if (added) openSheet();
}
function route() {
  const t = new URLSearchParams(location.search).get('o');
  $('shopView').hidden = !!t; $('trackView').hidden = !t; clearTimeout(pollT);
  if (t) { $('cartbar').hidden = true; loadOrder(t); window.scrollTo(0, 0); } else { renderCart(); }
}
window.addEventListener('popstate', route);
loadShop().then(route);
setInterval(() => SET && renderInfo(), 60000);
// Logo di-inline agar font brand ikut terpakai
const svgCache = {};
async function inlineSvg() {
  for (const el of document.querySelectorAll('[data-svg]:not([data-done])')) {
    el.dataset.done = 1;
    try { svgCache[el.dataset.svg] ??= await (await fetch(el.dataset.svg)).text(); el.innerHTML = svgCache[el.dataset.svg].replace(/<style>.*?<\/style>/s, ''); el.querySelector('svg')?.setAttribute('aria-hidden', 'true'); el.querySelector('svg')?.removeAttribute('width'); el.querySelector('svg')?.removeAttribute('height'); } catch {}
  }
}
new MutationObserver(inlineSvg).observe(document.body, { childList: true, subtree: true });
inlineSvg();
