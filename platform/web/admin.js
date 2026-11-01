const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const METHOD = { delivery: 'Antar', cod: 'COD', pickup: 'Ambil' };
const LABEL = { baru: 'Baru', dimasak: 'Dimasak', diantar: 'Diantar', siap: 'Siap diambil', selesai: 'Selesai', batal: 'Batal' };
const ACTIVE = ['baru', 'dimasak', 'diantar', 'siap'];
const jktDate = d => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
const jktTime = d => new Date(d).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
const waNum = p => { p = String(p).replace(/\D/g, ''); return p.startsWith('0') ? '62' + p.slice(1) : p; };
let ORD = [], MENU = [], SET = null, TAB = 'aktif', seen = new Set(), chan = null;
let SHOP = null, SHOPS = [];
const SID = () => SHOP.id;
const until = d => d ? new Date(d).getTime() : -Infinity;
const isActive = () => Date.now() < Math.max(until(SET?.trial_until), until(SET?.paid_until)) + 3 * 864e5;
const isPro = () => Date.now() < until(SET?.trial_until) || (SET?.plan === 'pro' && Date.now() < until(SET?.paid_until) + 3 * 864e5);
const SITE = () => shopUrl(SET?.slug || '');
const proLock = what => `<div class="card lock" style="margin-top:16px"><h3>${what}</h3><p class="muted" style="margin:6px 0 12px;font-size:14px">Fitur ini ada di paket Pro (${rp(CONFIG.PRICE.pro)}/bulan). Masa coba 14 hari sudah termasuk semua fitur Pro.</p><button type="button" class="btn btn-ghost" data-tab-go="atur">Lihat langganan</button></div>`;

/* ---------- auth ---------- */
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  session ? pickShop() : ($('loginView').hidden = false);
}
async function pickShop() {
  const { data, error } = await sb.from('shop_members').select('role, shops(*)').order('shop_id');
  SHOPS = (data || []).map(r => r.shops).filter(Boolean);
  if (error || !SHOPS.length) { location.href = '/daftar.html?langkah=toko'; return; }
  let want = null; try { want = localStorage.getItem('owner_shop'); } catch {}
  const baru = new URLSearchParams(location.search).get('baru');
  SHOP = SHOPS.find(x => x.slug === baru) || SHOPS.find(x => x.id === want) || SHOPS[0];
  try { localStorage.setItem('owner_shop', SHOP.id); } catch {}
  SET = SHOP; if (SET.categories?.length) CATS = SET.categories;
  $('shopTitle').textContent = SHOP.name;
  $('shopSwitch').hidden = SHOPS.length < 2;
  $('shopSwitch').innerHTML = SHOPS.map(x => `<option value="${x.id}" ${x.id === SHOP.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  start();
}
$('shopSwitch').onchange = e => { try { localStorage.setItem('owner_shop', e.target.value); } catch {} location.reload(); };
$('forgot').onclick = async () => {
  const email = $('loginForm').email.value.trim(), msg = $('loginErr');
  if (!email) { msg.textContent = 'Isi email dulu, lalu tekan Lupa password.'; msg.hidden = false; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/daftar.html?langkah=password' });
  msg.textContent = error ? 'Gagal: ' + error.message : 'Link ganti password sudah dikirim ke email kamu.'; msg.hidden = false;
};
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, { error } = await sb.auth.signInWithPassword({ email: f.email.value, password: f.password.value });
  if (error) { $('loginErr').textContent = 'Email atau password salah'; $('loginErr').hidden = false; return; }
  $('loginView').hidden = true; pickShop();
});
$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

async function start() {
  $('appView').hidden = false;
  await Promise.all([loadOrders(true), loadMenu(), loadSettings(), pushState().catch(() => {})]);
  loadPay().then(render);
  render();
  chan = sb.channel('orders-' + SID()).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: 'shop_id=eq.' + SID() }, async p => {
    if (p.eventType === 'INSERT') ding();
    await loadOrders(); render();
  }).subscribe();
  setInterval(async () => { await loadOrders(); render(); }, 60000);
}

/* ---------- data ---------- */
async function loadOrders(first) {
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const { data } = await sb.from('orders').select('*').eq('shop_id', SID()).or(`created_at.gte."${since}",status.in.(baru,dimasak,diantar,siap)`).order('created_at', { ascending: false });
  ORD = data || [];
  if (first) ORD.forEach(o => seen.add(o.id));
  const n = ORD.filter(o => ACTIVE.includes(o.status)).length;
  $('cAktif').textContent = n || ''; document.title = (n ? `(${n}) ` : '') + SHOP.name + ' · ' + CONFIG.BRAND;
}
async function loadMenu() { const [a, b] = await Promise.all([sb.from('menu_items').select('*').eq('shop_id', SID()).order('sort').order('id'), sb.from('vouchers').select('*').eq('shop_id', SID()).order('created_at')]); MENU = a.data || []; VCH = b.data || []; }
async function loadSettings() { const { data } = await sb.from('shops').select('*').eq('id', SID()).single(); SET = SHOP = data; if (SET?.categories?.length) CATS = SET.categories; $('openToggle').checked = !!SET?.is_open; }
async function upd(id, patch) {
  const { error } = await sb.from('orders').update(patch).eq('id', id);
  if (error) return alert('Gagal menyimpan: ' + error.message);
  await loadOrders(); render();
}
$('openToggle').onchange = async e => {
  const { error } = await sb.from('shops').update({ is_open: e.target.checked }).eq('id', SID());
  if (error) { alert('Gagal: ' + error.message); e.target.checked = !e.target.checked; }
};
function ding() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .18].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.3, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .15); o.start(a.currentTime + t); o.stop(a.currentTime + t + .16); }); } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

/* ---------- render ---------- */
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  TAB = b.dataset.tab; if (TAB === 'atur') loadPay().then(render); if (TAB === 'rekap') RK.rows = null; document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); render();
});
function render() {
  const p = $('panel');
  if (TAB === 'aktif') { const L = ORD.filter(o => ACTIVE.includes(o.status)); p.innerHTML = subBar() + setupHTML() + pushBar() + (L.length ? L.map(card).join('') : '<p class="empty">Belum ada pesanan aktif.</p>'); L.forEach(o => seen.add(o.id)); }
  if (TAB === 'selesai') { const L = ORD.filter(o => !ACTIVE.includes(o.status)); p.innerHTML = L.length ? L.map(card).join('') : '<p class="empty">Belum ada.</p>'; }
  if (TAB === 'menu') p.innerHTML = menuHTML();
  if (TAB === 'rekap') p.innerHTML = rekapHTML();
  if (TAB === 'atur') p.innerHTML = aturHTML();
}
function nextStatus(o) { return { baru: 'dimasak', dimasak: o.method === 'pickup' ? 'siap' : 'diantar', diantar: 'selesai', siap: 'selesai' }[o.status]; }
function custMsg(o) {
  const total = o.subtotal + (o.ongkir || 0) + (o.unique_code || 0), link = `${SITE()}/?o=${o.token}`;
  const m = { baru: `Pesanan #${o.code} sudah kami terima`, dimasak: `Pesanan #${o.code} sedang dimasak`, diantar: `Pesanan #${o.code} sedang diantar`, siap: `Pesanan #${o.code} sudah siap diambil${SET.pickup_note ? ' (' + SET.pickup_note + ')' : ''}`, selesai: `Terima kasih, pesanan #${o.code} selesai`, batal: `Mohon maaf, pesanan #${o.code} dibatalkan` }[o.status];
  return `${m}. Total ${rp(total)}${o.payment === 'qris' && !o.paid ? ' (bisa bayar QRIS di link)' : ''}.\n${link}\n\n— ${SET.name}`;
}
function card(o) {
  const needKm = o.method !== 'pickup', total = o.subtotal + (o.ongkir || 0) + (o.unique_code || 0), nx = nextStatus(o), isNew = !seen.has(o.id);
  return `<article class="card order${isNew ? ' new' : ''}">
    <div class="ohead"><h3>#${esc(o.code)}</h3><span class="muted">${jktDate(o.created_at) === jktDate(Date.now()) ? '' : jktDate(o.created_at) + ' '}${jktTime(o.created_at)}</span></div>
    <div class="badges"><span class="b gold">${LABEL[o.status]}</span><span class="b">${METHOD[o.method]}</span><span class="b ${o.paid ? 'ok' : 'red'}">${o.payment.toUpperCase()} · ${o.paid ? 'Lunas' : 'Belum bayar'}</span></div>
    ${o.payment === 'qris' && !o.paid && o.status !== 'batal' && Date.now() - new Date(o.created_at) > 10 * 6e4 ? '<p class="warnq">QRIS belum tercatat lunas lebih dari 10 menit. Cek DANA Bisnis; kalau uang sudah masuk, tekan <b>Tandai lunas</b>.</p>' : ''}
    <p style="margin:0;font-weight:800">${esc(o.name)} · <a href="https://wa.me/${waNum(o.phone)}" target="_blank" rel="noopener">${esc(o.phone)}</a></p>
    ${o.address ? `<p class="muted" style="margin-top:4px">${esc(o.address)}</p>` : ''}
    ${o.maps_link ? `<p style="margin:6px 0 0"><a href="${esc(o.maps_link)}" target="_blank" rel="noopener" style="font-weight:800">Buka lokasi di Maps →</a></p>` : ''}
    ${o.note ? `<p class="note" style="margin-top:8px">Catatan: ${esc(o.note)}</p>` : ''}
    <ul class="list" style="margin-top:8px">${o.items.map(i => `<li><span><b>${i.qty}×</b> ${esc(i.name)}${i.variant ? ` <em>· ${esc(i.variant)}</em>` : ''}</span><span>${rp(i.price * i.qty)}</span></li>`).join('')}</ul>
    ${o.discount ? `<div class="row"><span>Diskon${o.voucher ? ' ' + esc(o.voucher) : ''}</span><span>−${rp(o.discount)}</span></div>` : ''}
    <div class="row"><span>Subtotal</span><span>${rp(o.subtotal)}</span></div>
    ${needKm ? `<form class="km" data-km="${o.id}"><label style="display:flex;align-items:center;gap:8px;font-size:14px">Jarak<input name="km" type="number" step="0.1" min="0" max="50" inputmode="decimal" value="${o.distance_km ?? ''}" placeholder="km" required></label><button type="submit">Simpan</button><span class="muted">${o.distance_km != null ? rp(o.ongkir) : ''}</span></form>` : ''}
    ${o.unique_code ? `<div class="row"><span>Kode unik QRIS</span><span>${rp(o.unique_code)}</span></div>` : ''}
    <div class="row total"><span>Total</span><span>${needKm && o.distance_km == null ? rp(o.subtotal) + ' + ongkir' : rp(total)}</span></div>
    <div class="acts">
      ${nx ? `<button class="next" data-st="${o.id}|${nx}">→ ${LABEL[nx]}</button>` : ''}
      <button data-paid="${o.id}|${!o.paid}">${o.paid ? 'Batal lunas' : 'Tandai lunas'}</button>
      <a class="wa" target="_blank" rel="noopener" href="https://wa.me/${waNum(o.phone)}?text=${encodeURIComponent(custMsg(o))}">Kabari</a>
      <a class="wa" target="_blank" rel="noopener" href="https://wa.me/${waNum(o.phone)}?text=${encodeURIComponent(struk(o))}">Struk</a>
      ${ACTIVE.includes(o.status) ? `<button data-st="${o.id}|batal">Batalkan</button>` : ''}
      <button type="button" class="danger" data-block="${o.id}">Blokir nomor</button>
    </div></article>`;
}
let CATS = ['Paket Nasi', 'Lauk', 'Tambahan', 'Minuman'];
let EDIT = null;
const opt = t => ` <span class="muted" style="font-weight:600">(${t})</span>`;
function menuForm(m) {
  return `<form class="card mform" data-menu="${m ? m.id : 'new'}" style="margin:12px 0">
    <h3 style="margin-bottom:4px">${m ? 'Ubah menu' : 'Tambah menu baru'}</h3>
    <fieldset><legend>Kategori</legend><div class="chips">${CATS.map(c => `<label class="chip-r"><input type="radio" name="category" value="${c}" ${(m?.category || CATS[0]) === c ? 'checked' : ''}><span>${c}</span></label>`).join('')}</div></fieldset>
    <label>Nama menu<input name="name" required maxlength="60" value="${esc(m?.name || '')}" placeholder="Contoh: Nasi Ayam Geprek Keju"></label>
    <label>Harga (Rp)<input name="price" type="number" inputmode="numeric" min="0" step="500" required value="${m?.price ?? ''}" placeholder="16000"></label>
    <label>Pilihan rasa / varian${opt('pisahkan dengan koma')}<input name="variants" value="${esc((m?.variants || []).join(', '))}" placeholder="Original, Geprek, Penyet"></label>
    <label>Satuan${opt('mis. tusuk, porsi')}<input name="unit" maxlength="20" value="${esc(m?.unit || '')}"></label>
    ${isPro() ? '' : '<!--'}<div class="grid2"><label>Harga coret${opt('promo')}<input name="price_before" type="number" inputmode="numeric" min="0" step="500" value="${m?.price_before ?? ''}" placeholder="20000"></label><label>Stok hari ini${opt('kosong = bebas')}<input name="stock" type="number" inputmode="numeric" min="0" step="1" value="${m?.stock ?? ''}"></label></div>${isPro() ? '' : '-->'}
    <p class="err" hidden></p>
    <div class="acts"><button class="next" type="submit">Simpan</button><button type="button" data-cancel>Batal</button>${m ? `<button type="button" class="danger" data-del="${m.id}">Hapus</button>` : ''}</div>
  </form>`;
}
function menuRow(m) {
  return `<div class="mrow"><input type="checkbox" data-av="${m.id}" ${m.available ? 'checked' : ''} aria-label="${esc(m.name)} tersedia">
    <span class="n">${esc(m.name)}<small>${!m.available || m.stock === 0 ? 'Habis' : 'Tersedia'}${m.stock != null ? ' · sisa ' + m.stock : ''}${m.price_before ? ' · promo' : ''}${m.variants.length ? ' · ' + esc(m.variants.join(' / ')) : ''}${m.unit ? ' · per ' + esc(m.unit) : ''}</small></span>
    <input type="number" step="500" min="0" value="${m.price}" data-price="${m.id}" aria-label="Harga ${esc(m.name)}">
    <span class="mbtns"><button type="button" class="ico${m.featured ? ' on' : ''}" data-feat="${m.id}" aria-pressed="${!!m.featured}" aria-label="Jadikan menu andalan" title="Menu andalan">★</button><button type="button" class="ico" data-mup="${m.id}" aria-label="Naikkan urutan ${esc(m.name)}" title="Naikkan">↑</button><button type="button" class="edit" data-edit="${m.id}" aria-label="Ubah ${esc(m.name)}">Ubah</button></span></div>`;
}
function catHTML() {
  return `<div class="card" style="margin-top:16px"><h3>Kategori</h3><p class="muted" style="font-size:14px;margin:4px 0">Ganti nama lalu tekan Simpan. Tombol ↑ menaikkan urutan di halaman pembeli.</p>`
    + CATS.map((c, i) => `<form class="crow" data-cat="${i}"><input name="c" required maxlength="30" value="${esc(c)}" aria-label="Nama kategori"><button type="button" data-cup="${i}" ${i ? '' : 'disabled'} aria-label="Naikkan urutan">↑</button><button type="submit">Simpan</button><button type="button" class="danger" data-cdel="${i}">Hapus</button></form>`).join('')
    + `<form class="crow" data-cat="new"><input name="c" required maxlength="30" placeholder="Kategori baru, mis. Camilan" aria-label="Kategori baru"><button type="submit" class="next">+ Tambah</button></form></div>`;
}
async function saveCats(list, rename) {
  const { error } = await sb.from('shops').update({ categories: list }).eq('id', SID());
  if (error) return alert(error.message);
  if (rename) { const r = await sb.from('menu_items').update({ category: rename[1] }).eq('shop_id', SID()).eq('category', rename[0]); if (r.error) alert(r.error.message); }
  await Promise.all([loadSettings(), loadMenu()]); render();
}
let VCH = [];
function voucherHTML() {
  return `<div class="card" style="margin-top:16px"><h3>Kode promo</h3><p class="muted" style="font-size:14px;margin:4px 0 8px">Pembeli mengetik kode saat pesan. Bagikan lewat status WA atau Instagram. Centang = aktif.</p>
  ${VCH.map(v => `<div class="mrow"><input type="checkbox" data-vact="${esc(v.code)}" ${v.active ? 'checked' : ''} aria-label="Aktifkan ${esc(v.code)}"><span class="n">${esc(v.code)}<small>${v.kind === 'pct' ? 'potong ' + v.value + '%' : 'potong ' + rp(v.value)}${v.min_order ? ' · min. ' + rp(v.min_order) : ''} · dipakai ${v.used}${v.quota ? '/' + v.quota : ''}×</small></span><button type="button" class="edit" data-vdel="${esc(v.code)}">Hapus</button></div>`).join('')}
  <form class="vform" id="vcForm"><div class="grid2"><label>Kode<input name="code" required maxlength="20" placeholder="HEMAT5" autocapitalize="characters"></label><label>Potongan<input name="amount" type="number" inputmode="numeric" min="1" required placeholder="5000"></label></div>
  <div class="chips" role="radiogroup" aria-label="Jenis potongan"><label class="chip-r"><input type="radio" name="kind" value="rp" checked><span>Rupiah</span></label><label class="chip-r"><input type="radio" name="kind" value="pct"><span>Persen %</span></label></div>
  <div class="grid2"><label>Min. belanja (Rp)<input name="min_order" type="number" inputmode="numeric" min="0" step="1000" value="0"></label><label>Kuota${opt('kosong = bebas')}<input name="quota" type="number" inputmode="numeric" min="1"></label></div>
  <p class="err" id="vcErr" hidden></p><button class="btn btn-red" type="submit">+ Tambah kode promo</button></form></div>`;
}
function menuHTML() {
  return (isPro() ? bannerHTML() + voucherHTML() : proLock('Banner promo &amp; kode promo')) + catHTML() + importHTML() + `<div style="margin-top:16px">${EDIT === 'new' ? menuForm(null) : '<button class="btn btn-red" type="button" data-newmenu>+ Tambah menu</button>'}</div>`
    + CATS.map(c => `<h2 style="margin:24px 0 4px;color:var(--red)">${c}</h2>` + (MENU.filter(m => m.category === c).map(m => EDIT === m.id ? menuForm(m) : menuRow(m)).join('') || '<p class="muted" style="padding:8px 0">Belum ada menu.</p>')).join('')
    + '<p class="muted" style="margin:16px 0 32px">Centang = tersedia. Harga di kolom angka tersimpan otomatis. Tekan "Ubah" untuk ganti nama, varian, atau hapus.</p>';
}
/* ---------- notifikasi HP (web push) ---------- */
const PUSH_URL = CONFIG.SUPABASE_URL + '/functions/v1/push';
const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const u8 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
let PUSH_ON = false, PUSH_MSG = '';
const devName = () => { const u = navigator.userAgent; return (/iPhone|iPad/.test(u) ? 'iPhone' : /Android/.test(u) ? 'Android' : /Macintosh/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Perangkat') + (matchMedia('(display-mode: standalone)').matches ? ' · aplikasi' : ' · browser'); };
let SUBS = [], MY_EP = '';
async function pushState() {
  if (!pushOK() || Notification.permission !== 'granted') return (PUSH_ON = false);
  const r = await navigator.serviceWorker.getRegistration('/'); const s = r && await r.pushManager.getSubscription();
  if (!s) return (PUSH_ON = false);
  // Kalau server sudah menghapus langganan ini (kedaluwarsa), daftar ulang supaya notifikasi masuk lagi.
  const { data } = await sb.from('push_subs').select('endpoint').eq('endpoint', s.endpoint).maybeSingle();
  if (!data) { try { await s.unsubscribe(); } catch {} try { await pushEnable(); return true; } catch { return (PUSH_ON = false); } }
  await sb.from('push_subs').update({ ua: devName() }).eq('endpoint', s.endpoint);
  MY_EP = s.endpoint; return (PUSH_ON = true);
}
async function pushEnable() {
  if (!pushOK()) throw new Error(isIOS ? 'Di iPhone: pasang dulu dashboard ini ke Layar Utama (Bagikan → Tambah ke Layar Utama), buka dari ikonnya, lalu coba lagi.' : 'Browser ini belum bisa notifikasi. Buka dashboard di Chrome.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi belum diberikan. Ketuk ikon gembok di samping alamat situs → Notifikasi → Izinkan, lalu coba lagi.');
  await navigator.serviceWorker.register('/sw.js'); const reg = await navigator.serviceWorker.ready;
  // Selalu buat langganan baru yang segar; yang lama dibuang.
  let sub = await reg.pushManager.getSubscription();
  if (sub) { await sb.from('push_subs').delete().eq('endpoint', sub.endpoint); try { await sub.unsubscribe(); } catch {} }
  const { publicKey } = await fetch(PUSH_URL).then(r => r.json());
  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(publicKey) });
  const { error } = await sb.from('push_subs').upsert({ shop_id: SID(), endpoint: sub.endpoint, sub: sub.toJSON(), ua: devName() }); if (error) throw error;
  MY_EP = sub.endpoint; PUSH_ON = true;
}
const kasirOn = () => PAY?.last_ping && Date.now() - new Date(PAY.last_ping) < 5 * 6e4;
const pushBar = () => PUSH_ON || kasirOn() ? '' : `<div class="card pushbar"><b>Aktifkan bunyi pesanan baru</b><span>Paling mudah: pasang aplikasi Kasir di HP penjaga (Atur → Lunas otomatis QRIS → Hubungkan HP ini). HP langsung bunyi tiap ada pesanan, walau terkunci. Atau nyalakan notifikasi browser:</span><button type="button" class="btn btn-red" data-push-on>Nyalakan</button>${PUSH_MSG ? `<p class="err">${esc(PUSH_MSG)}</p>` : ''}</div>`;
function pushHTML() {
  return `<div class="card" style="margin-top:16px"><h3>Notifikasi pesanan baru</h3>
  <p class="muted" style="margin:6px 0 12px;font-size:14px">${PUSH_ON ? 'Aktif di HP ini. Tiap pesanan masuk, HP bunyi walau terkunci.' : 'Belum aktif di HP ini.'} <b>Lebih andal:</b> aplikasi Kasir sudah membunyikan pesanan baru sendiri tanpa setting tambahan. Notifikasi browser di bawah ini cadangan.</p>
  ${PUSH_MSG ? `<p class="err">${esc(PUSH_MSG)}</p>` : ''}
  <div class="acts">${PUSH_ON ? '<button type="button" class="next" data-push-test>Kirim notifikasi tes</button><button type="button" data-push-on>Daftar ulang HP ini</button>' : '<button type="button" class="next" data-push-on>Nyalakan di HP ini</button>'}</div>
  <h4 style="margin:16px 0 4px">Perangkat penerima (${SUBS.length})</h4>
  ${SUBS.length ? SUBS.map(s => `<div class="mrow"><span class="n">${esc(s.ua || 'Perangkat')}${s.endpoint === MY_EP ? ' (HP ini)' : ''}<small>didaftarkan ${jktDate(s.created_at)} ${jktTime(s.created_at)}</small></span><button type="button" class="edit" data-unsub="${esc(s.endpoint)}">Hapus</button></div>`).join('') : '<p class="muted" style="font-size:14px;margin:0">Belum ada. Tekan Nyalakan di tiap HP penjaga warung.</p>'}
  ${isIOS ? '<p class="muted" style="font-size:13px;margin:8px 0 0">iPhone: notifikasi hanya bisa dari dashboard yang dipasang di Layar Utama (bukan dari Safari).</p>' : ''}</div>`;
}
/* ---------- blokir nomor ---------- */
let BLK = [];
const normPhone = p => String(p || '').replace(/\D/g, '').replace(/^62/, '0');
function blockHTML() {
  return `<div class="card" style="margin-top:16px"><h3>Nomor diblokir</h3>
  <p class="muted" style="margin:6px 0 8px;font-size:14px">Nomor di sini tidak bisa pesan online. Blokir lewat tombol "Blokir nomor" di kartu pesanan. Satu nomor juga dibatasi maksimal 3 pesanan yang belum selesai.</p>
  ${BLK.length ? BLK.map(b => `<div class="mrow"><span class="n">${esc(b.phone)}<small>${esc(b.note || '')} · ${jktDate(b.created_at)}</small></span><button type="button" class="edit" data-unblock="${esc(b.phone)}">Buka blokir</button></div>`).join('') : '<p class="muted" style="margin:0">Belum ada.</p>'}</div>`;
}
/* ---------- banner promo ---------- */
const BN_MAX = 6;
const bnPath = u => decodeURIComponent(String(u).split('/object/public/shop/')[1] || '');
function bannerHTML() {
  const B = SET?.banners || [];
  return `<div class="card" style="margin-top:16px"><h3>Banner promo</h3>
  <p class="muted" style="font-size:14px;margin:4px 0 10px">Tampil bergeser di atas halaman pembeli. Bentuk terbaik melebar 2:1 (mis. 1200×600); foto otomatis dipotong di bagian tengah. Maksimal ${BN_MAX}.</p>
  ${B.length ? `<div class="bngrid">${B.map((u, i) => `<figure><img src="${esc(u)}" alt="Banner ${i + 1}" loading="lazy"><figcaption><button type="button" data-bup="${i}" ${i ? '' : 'disabled'} aria-label="Naikkan urutan">↑</button><button type="button" class="danger" data-bdel="${i}">Hapus</button></figcaption></figure>`).join('')}</div>` : ''}
  ${B.length < BN_MAX ? `<label class="btn btn-red bnadd" for="bnFile">+ Tambah banner</label><input type="file" id="bnFile" accept="image/*" hidden>` : ''}
  <p class="note" id="bnMsg" hidden></p></div>`;
}
async function cropBanner(file) {
  const img = await createImageBitmap(file);
  const W = 1200, H = 600, r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  let b = await new Promise(res => c.toBlob(res, 'image/webp', 0.85));
  if (!b || b.type !== 'image/webp') b = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
  return b;
}
async function saveBanners(list) {
  const { error } = await sb.from('shops').update({ banners: list }).eq('id', SID());
  if (error) alert(error.message); await loadSettings(); render();
}
async function addBanner(inp) {
  const f = inp.files?.[0]; if (!f) return; const msg = $('bnMsg'); msg.hidden = false; msg.textContent = 'Mengunggah…';
  try {
    const b = await cropBanner(f), ext = b.type === 'image/webp' ? 'webp' : 'jpg', path = `${SID()}/banner-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('shop').upload(path, b, { contentType: b.type, cacheControl: '31536000' });
    if (error) throw error;
    await saveBanners([...(SET?.banners || []), sb.storage.from('shop').getPublicUrl(path).data.publicUrl]);
  } catch (e) { msg.textContent = 'Gagal: ' + (e.message || e); }
}
let PAY = null, PLOG = [];
async function loadPay() { sb.from('push_subs').select('endpoint, ua, created_at').eq('shop_id', SID()).order('created_at', { ascending: false }).then(r => { SUBS = r.data || []; if (TAB === 'atur') render(); }); sb.from('blocked_phones').select('*').eq('shop_id', SID()).order('created_at', { ascending: false }).then(r => { BLK = r.data || []; if (TAB === 'atur') render(); }); const [a, b] = await Promise.all([sb.from('shops').select('kasir_secret, last_ping').eq('id', SID()).single(), sb.from('pay_log').select('*').eq('shop_id', SID()).order('at', { ascending: false }).limit(6)]); PAY = a.data && { secret: a.data.kasir_secret, last_ping: a.data.last_ping }; PLOG = b.data || []; }
const cfgText = () => `URL: ${CONFIG.SUPABASE_URL}/rest/v1/rpc/dana_paid\nMethod: POST\nHeader: apikey = ${CONFIG.SUPABASE_ANON_KEY}\nHeader: Content-Type = application/json\nBody: {"p_secret":"${PAY?.secret || ''}","p_text":"[notification]"}`;
const APK = CONFIG.APK;
const linkApp = () => `intent://setup?s=${PAY?.secret || ''}&u=${encodeURIComponent(CONFIG.SUPABASE_URL)}&k=${encodeURIComponent(CONFIG.SUPABASE_ANON_KEY)}#Intent;scheme=bhatrakasir;package=id.bhatra.kasir;S.browser_fallback_url=${encodeURIComponent(APK)};end`;
function kasirLine() {
  const t = PAY?.last_ping ? new Date(PAY.last_ping) : null, min = t ? Math.round((Date.now() - t) / 6e4) : null;
  if (!t) return '<p class="kasir off">Belum ada kabar dari HP kasir.</p>';
  const ago = min < 1 ? 'baru saja' : min < 60 ? min + ' menit lalu' : jktDate(t) === jktDate(Date.now()) ? 'jam ' + jktTime(t) : jktDate(t) + ' ' + jktTime(t);
  return `<p class="kasir ${min <= 30 ? 'on' : 'off'}">Kabar terakhir dari HP kasir: <b>${ago}</b>${min > 30 ? '. Kalau ada QRIS yang tidak lunas otomatis, buka aplikasi Kasir di HP itu dan pastikan statusnya AKTIF.' : ''}</p>`;
}
function payHTML() {
  return `<div class="card" style="margin-top:16px"><h3>Lunas otomatis QRIS</h3>
  <p class="muted" style="margin:6px 0 12px;font-size:14px">Pembeli QRIS membayar dengan kode unik (mis. Rp32.017). HP Android kasir membaca notifikasi uang masuk dari DANA, lalu pesanan dengan nominal yang sama otomatis Lunas. Aplikasi yang sama juga membunyikan setiap pesanan baru.</p>
  <ol style="margin:0 0 12px;padding-left:20px;display:grid;gap:6px;font-size:14px">
    <li>Di HP Android kasir, <a href="${APK}" style="font-weight:800">unduh &amp; install aplikasi Kasir</a>.</li>
    <li>Buka halaman ini di HP yang sama, tekan <b>Hubungkan HP ini</b>.</li>
    <li>Ikuti pop-up izin di aplikasi sampai status <b>AKTIF</b> hijau.</li>
    <li>Simpan, lalu tes bayar 1 pesanan QRIS. Hasilnya muncul di riwayat di bawah.</li>
  </ol>
  <div class="acts"><a class="next" href="${linkApp()}">Hubungkan HP ini</a><button type="button" data-copycfg>Salin kode</button></div>
  ${kasirLine()}
  <h4 style="margin:16px 0 4px">Riwayat notifikasi</h4>
  ${PLOG.length ? `<ul class="list">${PLOG.map(l => `<li><span>${jktTime(l.at)} · ${l.amount ? rp(l.amount) : '-'}</span><b style="color:${['lunas', 'terhubung'].includes(l.result) ? 'var(--ok)' : 'var(--red-d)'}">${l.result === 'lunas' ? 'Lunas #' + esc(l.order_code) : l.result === 'terhubung' ? 'Tes: terhubung ✓' : esc(l.result)}</b></li>`).join('')}</ul>` : '<p class="muted" style="font-size:14px">Belum ada.</p>'}
  </div>`;
}
function aturHTML() {
  const s = SET || {}, t = v => (v || '').slice(0, 5), full = s.open_time === s.close_time, delAll = (s.delivery_from || s.open_time) === s.open_time && s.delivery_until === s.close_time;
  return langgananHTML() + profilHTML() + `<form class="card" id="setForm" style="margin-top:16px">
    <h3>Jam &amp; pengiriman</h3>
    <label class="opt"><input type="checkbox" name="is_open" ${s.is_open ? 'checked' : ''}><span><b>Warung buka</b><small>Matikan saat libur atau bahan habis. Pembeli tidak bisa pesan.</small></span></label>
    <label class="opt"><input type="checkbox" name="full24" ${full ? 'checked' : ''}><span><b>Buka 24 jam</b><small>Pembeli bisa pesan kapan saja</small></span></label>
    <div class="grid2"${full ? ' hidden' : ''} id="hoursRow"><label>Jam buka<input type="time" name="open_time" value="${t(s.open_time)}"></label><label>Jam tutup<input type="time" name="close_time" value="${t(s.close_time)}"></label></div>
    <p class="muted" style="font-size:13px;margin-top:-6px"${full ? ' hidden' : ''} id="hoursHint">Boleh lewat tengah malam, misal 16.00 – 02.00.</p>
    <label class="opt"><input type="checkbox" name="delAll" ${delAll ? 'checked' : ''}><span><b>Antar &amp; COD selama warung buka</b><small>Matikan kalau antar hanya sampai jam tertentu</small></span></label>
    <div id="delRow" class="grid2"${delAll ? ' hidden' : ''}><label>Antar &amp; COD mulai<input type="time" name="delivery_from" value="${t(s.delivery_from || s.open_time)}"></label><label>sampai<input type="time" name="delivery_until" value="${t(s.delivery_until)}"></label></div>
    <fieldset><legend>Lokasi warung (untuk hitung jarak)</legend>
      <p class="muted" style="margin:0 0 8px;font-size:14px">${s.shop_lat != null ? `Tersimpan · <a href="https://maps.google.com/?q=${s.shop_lat},${s.shop_lng}" target="_blank" rel="noopener">cek di Maps</a>` : 'Belum diatur. Tekan tombol ini saat sedang di rumah.'}</p>
      <button type="button" class="btn btn-ghost" data-shoploc>Pakai lokasi saya sekarang</button>
    </fieldset>
    <label>Jangkauan antar maksimal (km)<input type="number" name="max_km" inputmode="decimal" min="0" step="0.5" value="${s.max_km ?? 10}"></label>
    <label>Ongkir per km (Rp)<input type="number" name="ongkir_per_km" inputmode="numeric" min="0" step="500" value="${s.ongkir_per_km ?? 1000}" required></label>
    <label>Gratis ongkir mulai belanja (Rp) <span class="muted" style="font-weight:600">(0 = tidak ada)</span><input type="number" name="free_ongkir_min" inputmode="numeric" min="0" step="1000" value="${s.free_ongkir_min ?? 0}"></label>
    <label>Lama siapkan pesanan (menit)<input type="number" name="prep_min" inputmode="numeric" min="5" max="180" step="5" value="${s.prep_min ?? 20}" required></label>
    <p class="note" id="setMsg" hidden></p>
    <button class="btn btn-red" type="submit">Simpan pengaturan</button>
  </form>
  ${qrisHTML()}
  ${pushHTML()}
  ${isPro() ? payHTML() : proLock('QRIS lunas otomatis &amp; bunyi pesanan (aplikasi Kasir)')}
  ${blockHTML()}
  <div class="card" style="margin:16px 0 32px"><h3>Link toko</h3><p class="muted" style="margin:6px 0 12px">Bagikan ke WA, status, dan bio Instagram.</p>
    <p style="font-weight:800;margin:0 0 12px;word-break:break-all">${esc(SITE())}</p>
    <div class="acts"><button type="button" class="next" data-copy>Salin link</button><button type="button" data-install>Pasang dashboard di HP</button><a class="wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Pesan ' + SET.name + ' online di ' + SITE())}">Bagikan ke WA</a></div></div>`;
}
/* ---------- persiapan toko (ceklis) ---------- */
function setupSteps() {
  return [
    ['Profil toko (nama, tagline, logo)', !!(SET.tagline || SET.logo_url), 'atur'],
    ['Lokasi warung untuk hitung ongkir', SET.shop_lat != null, 'atur'],
    ['Menu pertama', MENU.length > 0, 'menu'],
    ['QRIS toko (boleh dilewati kalau hanya tunai)', !!SET.qris_static, 'atur'],
    ['Bagikan link toko ke pelanggan', (() => { try { return localStorage.getItem('shared_' + SID()) === '1'; } catch { return false; } })(), 'atur']
  ];
}
function setupHTML() {
  const S = setupSteps(), done = S.filter(x => x[1]).length;
  if (done === S.length) return '';
  return `<div class="card setup" style="margin-top:16px"><h3>Siapkan toko kamu · ${done}/${S.length}</h3>
  <div class="bar"><i style="width:${Math.round(done / S.length * 100)}%"></i></div>
  ${S.map(([t, ok, tab]) => `<button type="button" class="step${ok ? ' ok' : ''}" data-tab-go="${tab}"><span>${ok ? '✓' : '○'}</span>${t}</button>`).join('')}</div>`;
}
function subBar() {
  const now = Date.now(), tr = until(SET.trial_until), pd = until(SET.paid_until), days = t => Math.max(0, Math.ceil((t - now) / 864e5));
  if (pd > now) return days(pd) <= 5 ? `<div class="card subbar warn"><b>Langganan ${SET.plan === 'pro' ? 'Pro' : 'Dasar'} habis ${days(pd)} hari lagi</b><button type="button" class="btn btn-red" data-tab-go="atur">Perpanjang</button></div>` : '';
  if (tr > now) return `<div class="card subbar"><b>Masa coba gratis: ${days(tr)} hari lagi</b><span>Semua fitur Pro aktif selama masa coba.</span><button type="button" class="btn btn-ghost" data-tab-go="atur">Lihat paket</button></div>`;
  if (isActive()) return `<div class="card subbar warn"><b>Masa aktif sudah habis</b><span>Toko masih bisa menerima pesanan beberapa hari lagi. Bayar langganan supaya tidak terputus.</span><button type="button" class="btn btn-red" data-tab-go="atur">Bayar langganan</button></div>`;
  return `<div class="card subbar bad"><b>Pesan online sedang nonaktif</b><span>Masa aktif toko sudah habis, jadi pembeli tidak bisa memesan. Bayar langganan untuk membukanya lagi.</span><button type="button" class="btn btn-red" data-tab-go="atur">Bayar langganan</button></div>`;
}
/* ---------- langganan ---------- */
function langgananHTML() {
  const fmt = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const st = until(SET.paid_until) > Date.now() ? `Paket <b>${SET.plan === 'pro' ? 'Pro' : 'Dasar'}</b> aktif sampai <b>${fmt(SET.paid_until)}</b>.`
    : until(SET.trial_until) > Date.now() ? `Masa coba gratis sampai <b>${fmt(SET.trial_until)}</b>. Semua fitur Pro aktif.`
    : 'Masa aktif sudah habis.';
  const wa = plan => `https://wa.me/${CONFIG.ADMIN_WA}?text=${encodeURIComponent(`Halo ${CONFIG.BRAND}, saya mau bayar langganan ${plan} untuk toko ${SET.name} (${SET.slug}).`)}`;
  return `<div class="card" style="margin-top:16px" id="langganan"><h3>Langganan</h3><p style="margin:6px 0 12px">${st}</p>
  <div class="plans">
    <div class="plan"><b>Dasar</b><p class="price">${rp(CONFIG.PRICE.dasar)}<small>/bulan</small></p><p class="muted">Pesan online, ongkir otomatis, tunai &amp; QRIS (cek manual), rekap hari ini.</p><a class="btn btn-ghost" target="_blank" rel="noopener" href="${wa('Dasar')}">Bayar Dasar</a></div>
    <div class="plan pro"><b>Pro</b><p class="price">${rp(CONFIG.PRICE.pro)}<small>/bulan</small></p><p class="muted">Semua Dasar + QRIS lunas otomatis, bunyi pesanan di HP, promo, stok, banner, rekap 30 hari &amp; Excel.</p><a class="btn btn-red" target="_blank" rel="noopener" href="${wa('Pro')}">Bayar Pro</a></div>
  </div>
  <p class="muted" style="font-size:13px;margin:10px 0 0">Bayar tahunan gratis 2 bulan. Setelah transfer, kirim bukti lewat WA; masa aktif diperpanjang di hari yang sama. Tanpa potongan per pesanan.</p></div>`;
}
/* ---------- profil toko ---------- */
const ACCENTS = ['#C8372D', '#E0612A', '#D99A1E', '#2F7D4F', '#1F7A8C', '#2E5AAC', '#7A3E9D', '#C2185B', '#3A1E12'];
function profilHTML() {
  return `<form class="card" id="profForm" style="margin-top:16px"><h3>Profil toko</h3>
    <div class="logo-row"><div class="brandmark sm">${SET.logo_url ? `<img src="${esc(SET.logo_url)}" alt="">` : `<span>${esc(SET.name.charAt(0).toUpperCase())}</span>`}</div>
      <div><label class="btn btn-ghost" for="logoFile" style="display:inline-flex;cursor:pointer">${SET.logo_url ? 'Ganti logo' : 'Unggah logo'}</label><input type="file" id="logoFile" accept="image/*" hidden>
      ${SET.logo_url ? '<button type="button" class="linkbtn" data-logo-del>Hapus logo</button>' : ''}<p class="muted" style="font-size:13px;margin:4px 0 0">Persegi, dipotong otomatis.</p></div></div>
    <label>Nama toko<input name="name" required maxlength="60" value="${esc(SET.name)}"></label>
    <label>Tagline${opt('tampil di bawah nama')}<input name="tagline" maxlength="80" value="${esc(SET.tagline)}" placeholder="Contoh: Masakan rumahan, harga pelajar"></label>
    <label>Nomor WhatsApp toko<input name="wa" type="tel" inputmode="tel" required value="${esc(SET.wa.replace(/^62/, '0'))}"></label>
    <label>Alamat singkat${opt('tampil di bawah halaman')}<input name="address" maxlength="120" value="${esc(SET.address)}" placeholder="Desa, Kecamatan, Kota"></label>
    <label>Petunjuk ambil sendiri${opt('opsional')}<input name="pickup_note" maxlength="80" value="${esc(SET.pickup_note)}" placeholder="Contoh: rumah pagar hijau depan masjid"></label>
    <fieldset><legend>Warna toko</legend><div class="swatches">${ACCENTS.map(c => `<label class="sw"><input type="radio" name="accent" value="${c}" ${SET.accent === c ? 'checked' : ''}><span style="background:${c}" aria-label="${c}"></span></label>`).join('')}</div></fieldset>
    <p class="note" id="profMsg" hidden></p>
    <button class="btn btn-red" type="submit">Simpan profil</button></form>`;
}
async function cropSquare(file, size = 512) {
  const img = await createImageBitmap(file), c = document.createElement('canvas'); c.width = c.height = size;
  const r = Math.max(size / img.width, size / img.height), w = img.width * r, h = img.height * r;
  c.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  let b = await new Promise(res => c.toBlob(res, 'image/webp', 0.88));
  if (!b || b.type !== 'image/webp') b = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.88));
  return b;
}
async function uploadLogo(inp) {
  const f = inp.files?.[0]; if (!f) return; const msg = $('profMsg'); msg.hidden = false; msg.textContent = 'Mengunggah logo…';
  try {
    const b = await cropSquare(f), path = `${SID()}/logo-${Date.now()}.${b.type === 'image/webp' ? 'webp' : 'jpg'}`;
    const { error } = await sb.storage.from('shop').upload(path, b, { contentType: b.type, cacheControl: '31536000' }); if (error) throw error;
    if (SET.logo_url) sb.storage.from('shop').remove([bnPath(SET.logo_url)]);
    await sb.from('shops').update({ logo_url: sb.storage.from('shop').getPublicUrl(path).data.publicUrl }).eq('id', SID());
    await loadSettings(); render();
  } catch (e) { msg.textContent = 'Gagal: ' + (e.message || e); }
}
/* ---------- QRIS toko ---------- */
function qrisHTML() {
  return `<div class="card" style="margin-top:16px"><h3>QRIS toko</h3>
  ${SET.qris_static ? `<p style="margin:6px 0 10px">Terpasang: <b>${esc(SET.qris_merchant || 'QRIS')}</b>. Pembeli bisa memilih bayar QRIS; nominal terisi otomatis.</p>` : '<p class="muted" style="margin:6px 0 10px;font-size:14px">Belum ada. Tanpa QRIS, pembeli hanya bisa bayar tunai.</p>'}
  <p class="muted" style="font-size:14px;margin:0 0 10px">Foto atau screenshot QRIS statis toko (yang biasa ditempel di meja), dari DANA Bisnis, GoPay Merchant, ShopeePay, atau bank.</p>
  <div class="acts"><label class="next" for="qrisFile" style="cursor:pointer">${SET.qris_static ? 'Ganti QRIS' : 'Unggah foto QRIS'}</label><input type="file" id="qrisFile" accept="image/*" hidden>${SET.qris_static ? '<button type="button" class="danger" data-qris-del>Hapus QRIS</button>' : ''}</div>
  <p class="note" id="qrisMsg" hidden></p></div>`;
}
async function readQris(inp) {
  const f = inp.files?.[0]; if (!f) return; const msg = $('qrisMsg'); msg.hidden = false; msg.textContent = 'Membaca QRIS…';
  try {
    const img = await createImageBitmap(f), sc = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height), q = window.jsQR && jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
    if (!q) { msg.textContent = 'QR tidak terbaca. Foto lebih dekat dan terang, atau pakai screenshot QRIS dari aplikasi.'; return; }
    const r = qrisCheck(q.data); if (!r.ok) { msg.textContent = r.msg; return; }
    const { error } = await sb.from('shops').update({ qris_static: r.payload, qris_merchant: r.merchant }).eq('id', SID());
    if (error) throw error; await loadSettings(); render();
  } catch (e) { msg.textContent = 'Gagal: ' + (e.message || e); }
}
/* ---------- impor menu dari teks ---------- */
function importHTML() {
  return `<details class="card" style="margin-top:16px"><summary><b>Tambah banyak menu sekaligus</b></summary>
  <p class="muted" style="font-size:14px;margin:8px 0">Satu baris satu menu: <b>Nama, Harga, Kategori</b>. Varian boleh ditambah setelah kategori, dipisah garis miring.<br>Contoh: <code>Ayam Geprek, 16000, Makanan, Original/Pedas</code></p>
  <textarea id="impText" rows="6" placeholder="Nasi Ayam Bakar, 18000, Makanan&#10;Es Teh, 4000, Minuman"></textarea>
  <p class="note" id="impMsg" hidden></p><button type="button" class="btn btn-red" data-import style="margin-top:8px">Tambahkan</button></details>`;
}
async function importMenu() {
  const msg = $('impMsg'), rows = [], bad = [], cats = [...CATS];
  $('impText').value.split('\n').map(l => l.trim()).filter(Boolean).forEach((l, i) => {
    const [name, price, cat, vars] = l.split(',').map(x => (x || '').trim()), p = parseInt(String(price).replace(/\D/g, ''), 10);
    if (!name || !(p >= 0)) { bad.push(i + 1); return; }
    const category = cat || cats[0] || 'Menu'; if (!cats.includes(category)) cats.push(category);
    rows.push({ shop_id: SID(), name, price: p, category, variants: vars ? vars.split('/').map(v => v.trim()).filter(Boolean) : [], sort: MENU.length + rows.length });
  });
  msg.hidden = false;
  if (!rows.length) { msg.textContent = 'Belum ada baris yang benar. Format: Nama, Harga, Kategori'; return; }
  if (cats.length !== CATS.length) await sb.from('shops').update({ categories: cats }).eq('id', SID());
  const { error } = await sb.from('menu_items').insert(rows);
  if (error) { msg.textContent = 'Gagal: ' + error.message; return; }
  await Promise.all([loadSettings(), loadMenu()]); render();
  if (bad.length) alert(`${rows.length} menu ditambahkan. Baris ${bad.join(', ')} dilewati karena formatnya salah.`);
}
let RK = { days: 1, rows: null };
async function loadRekap() {
  const start = new Date(new Date(jktDate(Date.now()) + 'T00:00:00+07:00').getTime() - (RK.days - 1) * 864e5).toISOString();
  const { data } = await sb.from('orders').select('*').gte('created_at', start).order('created_at', { ascending: false }).limit(5000);
  RK.rows = data || []; if (TAB === 'rekap') render();
}
function rekapCSV() {
  const head = ['Tanggal', 'Jam', 'Kode', 'Nama', 'No WA', 'Cara', 'Bayar', 'Status', 'Lunas', 'Isi pesanan', 'Subtotal', 'Diskon', 'Ongkir', 'Total'];
  const rows = (RK.rows || []).map(o => [jktDate(o.created_at), jktTime(o.created_at), o.code, o.name, "'" + o.phone, METHOD[o.method], o.payment.toUpperCase(), LABEL[o.status], o.paid ? 'ya' : 'tidak',
    o.items.map(i => `${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''}`).join('; '), o.subtotal, o.discount || 0, o.ongkir || 0, o.subtotal + (o.ongkir || 0) + (o.unique_code || 0)]);
  const csv = '﻿' + [head, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `rekap-${SET.slug}-${jktDate(Date.now())}-${RK.days}hari.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function rekapHTML() {
  const chips = `<div class="chips" style="margin-top:16px" role="group" aria-label="Periode">${[[1, 'Hari ini'], [7, '7 hari'], [30, '30 hari']].map(([d, t]) => `<button type="button" class="chip" data-rk="${d}" aria-pressed="${RK.days === d}" ${d > 1 && !isPro() ? 'disabled title="Paket Pro"' : ''}>${t}${d > 1 && !isPro() ? ' · Pro' : ''}</button>`).join('')}</div>`;
  if (!RK.rows) { loadRekap(); return chips + '<p class="empty">Memuat rekap…</p>'; }
  const L = RK.rows, done = L.filter(o => o.status === 'selesai');
  const omzet = done.reduce((a, o) => a + o.subtotal, 0), ongkir = done.reduce((a, o) => a + (o.ongkir || 0), 0), disc = done.reduce((a, o) => a + (o.discount || 0), 0);
  const qris = done.filter(o => o.payment === 'qris').reduce((a, o) => a + o.subtotal + (o.ongkir || 0), 0);
  const top = {}; done.forEach(o => o.items.forEach(i => { const k = i.name + (i.variant ? ' · ' + i.variant : ''); top[k] = (top[k] || 0) + i.qty; }));
  const T = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const hrs = Array(24).fill(0); done.forEach(o => { hrs[+new Date(o.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }) % 24]++; });
  const hmax = Math.max(1, ...hrs), H = hrs.map((n, h) => [h, n]).filter(([, n]) => n);
  const cust = {}; done.forEach(o => { const k = normPhone(o.phone); (cust[k] ||= { name: o.name, n: 0, t: 0 }); cust[k].n++; cust[k].t += o.subtotal; });
  const C = Object.values(cust).sort((a, b) => b.n - a.n || b.t - a.t).slice(0, 5);
  const label = RK.days === 1 ? 'hari ini' : RK.days + ' hari terakhir';
  return chips + `
  <div class="stats">
    <div class="stat"><p>Omzet menu</p><b>${rp(omzet)}</b></div>
    <div class="stat"><p>Pesanan selesai</p><b>${done.length}</b></div>
    <div class="stat"><p>Rata-rata / pesanan</p><b>${rp(done.length ? Math.round(omzet / done.length) : 0)}</b></div>
    <div class="stat"><p>Ongkir</p><b>${rp(ongkir)}</b></div>
    <div class="stat"><p>Masuk via QRIS</p><b>${rp(qris)}</b></div>
    <div class="stat"><p>Diskon promo</p><b>${rp(disc)}</b></div>
  </div>
  <div class="card"><h3>Menu terlaris</h3>${T.length ? `<ul class="list">${T.map(([k, q], i) => `<li><span>${i + 1}. ${esc(k)}</span><b>${q}</b></li>`).join('')}</ul>` : `<p class="muted">Belum ada pesanan selesai ${label}.</p>`}</div>
  <div class="card" style="margin-top:12px"><h3>Jam ramai</h3>${H.length ? `<div class="hbars">${H.map(([h, n]) => `<div class="hb"><span>${String(h).padStart(2, '0')}.00</span><i style="width:${Math.round(n / hmax * 100)}%"></i><b>${n}</b></div>`).join('')}</div>` : '<p class="muted">Belum ada data.</p>'}</div>
  <div class="card" style="margin-top:12px"><h3>Pelanggan langganan</h3>${C.length ? `<ul class="list">${C.map(c => `<li><span>${esc(c.name)}<small class="muted" style="display:block;font-size:13px">${c.n}× pesan</small></span><b>${rp(c.t)}</b></li>`).join('')}</ul>` : '<p class="muted">Belum ada data.</p>'}</div>
  ${isPro() ? `<div class="acts" style="margin-top:12px"><button type="button" class="next" data-csv>Unduh Excel (${L.length} pesanan)</button></div>` : ''}
  <p class="muted" style="margin:12px 0 32px">Angka dihitung dari pesanan berstatus Selesai, ${label}. Batal: ${L.filter(o => o.status === 'batal').length}. File unduhan berisi semua pesanan di periode ini dan bisa dibuka di Excel atau Google Sheets.</p>`;
}
function struk(o) {
  const L = o.items.map(i => `${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''} — ${rp(i.price * i.qty)}`).join('\n');
  const total = o.subtotal + (o.ongkir || 0) + (o.unique_code || 0);
  return `*STRUK ${SET.name.toUpperCase()}*\n#${o.code} · ${jktDate(o.created_at)} ${jktTime(o.created_at)}\n${o.name}\n------------------------\n${L}\n------------------------${o.discount ? `\nDiskon ${o.voucher || ''}: -${rp(o.discount)}` : ''}\nSubtotal: ${rp(o.subtotal)}${o.ongkir ? `\nOngkir: ${rp(o.ongkir)}` : ''}${o.unique_code ? `\nKode unik QRIS: ${rp(o.unique_code)}` : ''}\n*Total: ${rp(total)}*\n${METHOD[o.method]} · ${o.payment === 'qris' ? 'QRIS' : 'Tunai'} · ${o.paid ? 'LUNAS' : 'Belum bayar'}\n\nTerima kasih! Pesan lagi di ${SITE()}`;
}
function rekapHTML_old() {
  const today = jktDate(Date.now()), L = ORD.filter(o => jktDate(o.created_at) === today), done = L.filter(o => o.status === 'selesai');
  const omzet = done.reduce((a, o) => a + o.subtotal, 0), ongkir = done.reduce((a, o) => a + (o.ongkir || 0), 0);
  const qris = done.filter(o => o.payment === 'qris').reduce((a, o) => a + o.subtotal + o.ongkir, 0);
  const top = {}; done.forEach(o => o.items.forEach(i => { const k = i.name + (i.variant ? ' · ' + i.variant : ''); top[k] = (top[k] || 0) + i.qty; }));
  const T = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<h2 style="margin-top:20px">Hari ini</h2>
  <div class="stats">
    <div class="stat"><p>Omzet menu</p><b>${rp(omzet)}</b></div>
    <div class="stat"><p>Pesanan selesai</p><b>${done.length}</b></div>
    <div class="stat"><p>Ongkir</p><b>${rp(ongkir)}</b></div>
    <div class="stat"><p>Masuk via QRIS</p><b>${rp(qris)}</b></div>
  </div>
  <div class="card"><h3>Menu terlaris</h3>${T.length ? `<ul class="list">${T.map(([k, q], i) => `<li><span>${i + 1}. ${esc(k)}</span><b>${q}</b></li>`).join('')}</ul>` : '<p class="muted">Belum ada pesanan selesai hari ini.</p>'}</div>
  <p class="muted" style="margin:12px 0">Dihitung dari pesanan berstatus Selesai. Batal: ${L.filter(o => o.status === 'batal').length}.</p>`;
}
$('panel').addEventListener('click', e => {
  const tg = e.target.closest('[data-tab-go]'); if (tg) { document.querySelector(`.tabs [data-tab="${tg.dataset.tabGo}"]`)?.click(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-import]')) return importMenu();
  if (e.target.closest('[data-qris-del]')) { if (!confirm('Hapus QRIS toko? Pembeli hanya bisa bayar tunai.')) return; sb.from('shops').update({ qris_static: null, qris_merchant: null }).eq('id', SID()).then(() => loadSettings()).then(render); return; }
  if (e.target.closest('[data-logo-del]')) { sb.storage.from('shop').remove([bnPath(SET.logo_url)]); sb.from('shops').update({ logo_url: null }).eq('id', SID()).then(() => loadSettings()).then(render); return; }
  const s = e.target.closest('[data-st]'); if (s) { const [id, st] = s.dataset.st.split('|'); if (st === 'batal' && !confirm('Batalkan pesanan ini?')) return; return upd(id, { status: st }); }
  const pd = e.target.closest('[data-paid]'); if (pd) { const [id, v] = pd.dataset.paid.split('|'); return upd(id, { paid: v === 'true' }); }
  if (e.target.closest('[data-newmenu]')) { EDIT = 'new'; return render(); }
  const ed = e.target.closest('[data-edit]'); if (ed) { EDIT = +ed.dataset.edit; return render(); }
  if (e.target.closest('[data-cancel]')) { EDIT = null; return render(); }
  if (e.target.closest('[data-push-on]')) { PUSH_MSG = ''; pushEnable().catch(x => { PUSH_MSG = x.message || String(x); }).finally(render); return; }
  const pt = e.target.closest('[data-push-test]');
  if (pt) { pt.disabled = true; pt.textContent = 'Mengirim…'; sb.rpc('push_test', { p_shop: SID() }).then(({ error }) => { pt.textContent = error ? 'Gagal: ' + error.message : `Terkirim ke ${SUBS.length} perangkat. Cek notifikasi.`; }); return; }
  const bk = e.target.closest('[data-block]');
  if (bk) { const o = ORD.find(x => String(x.id) === bk.dataset.block); if (!o) return; const ph = normPhone(o.phone), act = ACTIVE.includes(o.status);
    if (!confirm(`Blokir ${ph}? Nomor ini tidak bisa pesan online lagi${act ? ' dan pesanan ini dibatalkan' : ''}.`)) return;
    (async () => { const { error } = await sb.from('blocked_phones').upsert({ shop_id: SID(), phone: ph, note: o.name }); if (error) return alert(error.message); if (act) await upd(o.id, { status: 'batal' }); alert('Nomor diblokir. Bisa dibuka lagi di Atur.'); })(); return; }
  const us = e.target.closest('[data-unsub]');
  if (us) { (async () => { await sb.from('push_subs').delete().eq('endpoint', us.dataset.unsub); if (us.dataset.unsub === MY_EP) PUSH_ON = false; await loadPay(); render(); })(); return; }
  const ub = e.target.closest('[data-unblock]');
  if (ub) { (async () => { await sb.from('blocked_phones').delete().eq('shop_id', SID()).eq('phone', ub.dataset.unblock); BLK = BLK.filter(b => b.phone !== ub.dataset.unblock); render(); })(); return; }
  const bu = e.target.closest('[data-bup]'); if (bu) { const i = +bu.dataset.bup, l = [...(SET?.banners || [])]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return saveBanners(l); }
  const bd = e.target.closest('[data-bdel]');
  if (bd) { const B = SET?.banners || [], u = B[+bd.dataset.bdel]; if (!confirm('Hapus banner ini?')) return; (async () => { await sb.storage.from('shop').remove([bnPath(u)]); saveBanners(B.filter(x => x !== u)); })(); return; }
  const rk = e.target.closest('[data-rk]'); if (rk) { RK.days = +rk.dataset.rk; RK.rows = null; return render(); }
  if (e.target.closest('[data-csv]')) return rekapCSV();
  const ft = e.target.closest('[data-feat]');
  if (ft) { const m = MENU.find(x => x.id === +ft.dataset.feat); if (!m) return; (async () => { const { error } = await sb.from('menu_items').update({ featured: !m.featured }).eq('id', m.id); if (error) alert(error.message); await loadMenu(); render(); })(); return; }
  const mu = e.target.closest('[data-mup]');
  if (mu) { const m = MENU.find(x => x.id === +mu.dataset.mup); if (!m) return; const L = MENU.filter(x => x.category === m.category), i = L.indexOf(m); if (i < 1) return;
    const arr = [...L]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; const base = Math.min(...L.map(x => x.sort));
    (async () => { await Promise.all(arr.map((x, j) => x.sort !== base + j ? sb.from('menu_items').update({ sort: base + j }).eq('id', x.id) : null)); await loadMenu(); render(); })(); return; }
  const vd = e.target.closest('[data-vdel]');
  if (vd) { if (!confirm(`Hapus kode promo ${vd.dataset.vdel}?`)) return; (async () => { await sb.from('vouchers').delete().eq('shop_id', SID()).eq('code', vd.dataset.vdel); await loadMenu(); render(); })(); return; }
  const cu = e.target.closest('[data-cup]'); if (cu) { const i = +cu.dataset.cup, l = [...CATS]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return saveCats(l); }
  const cd = e.target.closest('[data-cdel]');
  if (cd) { const c = CATS[+cd.dataset.cdel], n = MENU.filter(m => m.category === c).length;
    if (n) return alert(`Masih ada ${n} menu di "${c}". Pindahkan dulu ke kategori lain (tekan Ubah di menunya) atau hapus menunya.`);
    if (CATS.length < 2) return alert('Minimal harus ada 1 kategori.');
    if (!confirm(`Hapus kategori "${c}"?`)) return; return saveCats(CATS.filter(x => x !== c)); }
  const dl = e.target.closest('[data-del]');
  if (dl) { if (!confirm('Hapus menu ini? Pesanan lama tidak terpengaruh.')) return; (async () => { const { error } = await sb.from('menu_items').delete().eq('id', dl.dataset.del); if (error) return alert(error.message); EDIT = null; await loadMenu(); render(); })(); return; }
  const sl = e.target.closest('[data-shoploc]');
  if (sl) { if (!navigator.geolocation) return alert('Perangkat tidak mendukung lokasi'); sl.disabled = true; sl.textContent = 'Mencari lokasi…';
    navigator.geolocation.getCurrentPosition(async p => { const { error } = await sb.from('shops').update({ shop_lat: p.coords.latitude, shop_lng: p.coords.longitude }).eq('id', SID()); if (error) alert(error.message); await loadSettings(); render(); },
      () => { sl.disabled = false; sl.textContent = 'Pakai lokasi saya sekarang'; alert('Izinkan akses lokasi di browser lalu coba lagi.'); }, { enableHighAccuracy: true, timeout: 15000 }); return; }
  if (e.target.closest('[data-copycfg]')) { navigator.clipboard?.writeText(cfgText()).then(() => { e.target.textContent = 'Tersalin ✓'; }); return; }
  if (e.target.closest('[data-copy]')) { try { localStorage.setItem('shared_' + SID(), '1'); } catch {} navigator.clipboard?.writeText(SITE()).then(() => { e.target.textContent = 'Tersalin ✓'; }); }
  if (e.target.closest('.wa') && TAB === 'atur') { try { localStorage.setItem('shared_' + SID(), '1'); } catch {} }
});
$('panel').addEventListener('submit', async e => {
  if (e.target.id === 'profForm') {
    e.preventDefault(); const f = e.target, msg = $('profMsg'); let wa = f.wa.value.replace(/\D/g, '');
    if (!/^(62|0)8\d{7,12}$/.test(wa)) { msg.hidden = false; msg.textContent = 'Nomor WA belum benar (contoh 0812xxxxxxx).'; return; }
    if (wa.startsWith('0')) wa = '62' + wa.slice(1);
    const patch = { name: f.name.value.trim(), tagline: f.tagline.value.trim(), wa, address: f.address.value.trim(), pickup_note: f.pickup_note.value.trim(), accent: f.accent.value || SET.accent };
    const { error } = await sb.from('shops').update(patch).eq('id', SID());
    msg.hidden = false; msg.textContent = error ? 'Gagal: ' + error.message : 'Tersimpan.';
    if (!error) { await loadSettings(); $('shopTitle').textContent = SET.name; } return;
  }
  if (e.target.id === 'vcForm') {
    e.preventDefault(); const f = e.target, err = $('vcErr');
    const row = { code: f.code.value.trim().toUpperCase().replace(/\s+/g, ''), kind: f.kind.value, value: parseInt(f.amount.value, 10), min_order: parseInt(f.min_order.value, 10) || 0, quota: parseInt(f.quota.value, 10) || null };
    if (!/^[A-Z0-9]{3,20}$/.test(row.code)) { err.textContent = 'Kode 3–20 huruf/angka, tanpa spasi.'; err.hidden = false; return; }
    if (!(row.value > 0) || (row.kind === 'pct' && row.value > 100)) { err.textContent = 'Isi potongan dengan benar (persen maksimal 100).'; err.hidden = false; return; }
    const { error } = await sb.from('vouchers').insert({ ...row, shop_id: SID() });
    if (error) { err.textContent = /duplicate/i.test(error.message) ? 'Kode itu sudah ada.' : error.message; err.hidden = false; return; }
    await loadMenu(); render(); return;
  }
  if (e.target.matches('.crow')) {
    e.preventDefault(); const v = e.target.c.value.trim().replace(/\s+/g, ' '), i = e.target.dataset.cat; if (!v) return;
    if (CATS.some((c, j) => c.toLowerCase() === v.toLowerCase() && String(j) !== i)) return alert('Kategori itu sudah ada.');
    if (i === 'new') return saveCats([...CATS, v]);
    const old = CATS[+i]; if (old === v) return; const l = [...CATS]; l[+i] = v; return saveCats(l, [old, v]);
  }
  if (e.target.matches('.mform')) {
    e.preventDefault(); const f = e.target, err = f.querySelector('.err'), id = f.dataset.menu;
    const row = { category: f.category.value, name: f.name.value.trim(), price: parseInt(f.price.value, 10),
      variants: f.variants.value.split(',').map(x => x.trim()).filter(Boolean), unit: f.unit.value.trim() };
    if (f.price_before) { row.price_before = parseInt(f.price_before.value, 10) || null; row.stock = f.stock.value === '' ? null : Math.max(0, parseInt(f.stock.value, 10) || 0); }
    if (!row.name || !(row.price >= 0)) { err.textContent = 'Nama dan harga wajib diisi'; err.hidden = false; return; }
    let r;
    if (id === 'new') { row.sort = Math.max(0, ...MENU.filter(m => m.category === row.category).map(m => m.sort)) + 1 || CATS.indexOf(row.category) * 10; r = await sb.from('menu_items').insert({ ...row, shop_id: SID() }); }
    else r = await sb.from('menu_items').update(row).eq('id', id);
    if (r.error) { err.textContent = r.error.message; err.hidden = false; return; }
    EDIT = null; await loadMenu(); render(); return;
  }
  if (e.target.id === 'setForm') {
    e.preventDefault(); const f = e.target, msg = $('setMsg');
    const full = f.full24.checked, open_time = full ? '00:00' : f.open_time.value, close_time = full ? '00:00' : f.close_time.value;
    if (!open_time || !close_time || (!full && open_time === close_time)) { msg.hidden = false; msg.textContent = 'Isi jam buka dan jam tutup (atau centang Buka 24 jam).'; return; }
    const delivery_from = f.delAll.checked ? open_time : f.delivery_from.value, delivery_until = f.delAll.checked ? close_time : f.delivery_until.value;
    if (!delivery_from || !delivery_until) { msg.hidden = false; msg.textContent = 'Isi jam mulai dan jam selesai Antar & COD.'; return; }
    const patch = { is_open: f.is_open.checked, open_time, close_time, delivery_from, delivery_until, ongkir_per_km: parseInt(f.ongkir_per_km.value, 10) || 0, max_km: parseFloat(f.max_km.value) || 0, free_ongkir_min: parseInt(f.free_ongkir_min.value, 10) || 0, prep_min: parseInt(f.prep_min.value, 10) || 20 };
    const { error } = await sb.from('shops').update(patch).eq('id', SID());
    msg.hidden = false; msg.textContent = error ? 'Gagal: ' + error.message : 'Tersimpan. Halaman pembeli langsung ikut berubah.';
    if (!error) await loadSettings(); return;
  }
  const f = e.target.closest('[data-km]'); if (!f) return; e.preventDefault();
  const km = Math.round(parseFloat(f.km.value.replace(',', '.')) * 10) / 10; if (!(km >= 0)) return;
  const od = ORD.find(x => String(x.id) === String(f.dataset.km)), free = +SET?.free_ongkir_min > 0 && (od?.subtotal || 0) >= +SET.free_ongkir_min;
  upd(f.dataset.km, { distance_km: km, ongkir: free ? 0 : Math.ceil(km * (SET?.ongkir_per_km || 1000) / 500) * 500 });
});
$('panel').addEventListener('change', async e => {
  if (e.target.id === 'logoFile') return uploadLogo(e.target);
  if (e.target.id === 'qrisFile') return readQris(e.target);
  if (e.target.id === 'bnFile') return addBanner(e.target);
  if (e.target.dataset.vact) { const { error } = await sb.from('vouchers').update({ active: e.target.checked }).eq('shop_id', SID()).eq('code', e.target.dataset.vact); if (error) alert(error.message); await loadMenu(); return; }
  if (e.target.name === 'full24') { $('hoursRow').hidden = e.target.checked; $('hoursHint').hidden = e.target.checked; return; }
  if (e.target.name === 'delAll') { $('delRow').hidden = e.target.checked; return; }
  const av = e.target.dataset.av, pr = e.target.dataset.price;
  if (av) { const { error } = await sb.from('menu_items').update({ available: e.target.checked }).eq('id', av); if (error) alert(error.message); await loadMenu(); render(); }
  if (pr) { const v = parseInt(e.target.value, 10); if (v >= 0) { const { error } = await sb.from('menu_items').update({ price: v }).eq('id', pr); if (error) alert(error.message); await loadMenu(); } }
});
init();
