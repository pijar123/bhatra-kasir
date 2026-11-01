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
let ORD = [], MENU = [], SET = null, MYSHOPS = [], TAB = 'aktif', seen = new Set(), chan = null;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const shopUrl = () => window.shopLink(SET);
const isActive = () => !SET.suspended && ((SET.plan === 'trial' && new Date(SET.trial_until) > Date.now()) || (SET.paid_until && new Date(SET.paid_until) > Date.now() - 3 * 864e5));
const isPro = () => isActive() && ['pro', 'trial'].includes(SET.plan);
const proLock = what => `<div class="card lock" style="margin-top:16px"><h3>${what}</h3><p class="muted" style="font-size:14px;margin:6px 0 0">Fitur paket Pro. Lihat <b>Atur → Paket</b> untuk naik paket.</p></div>`;

/* ---------- auth ---------- */
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  session ? pickShop() : ($('loginView').hidden = false);
}
// Akun bisa punya lebih dari satu toko: pilih, lalu ingat pilihannya di HP ini.
async function pickShop() {
  const { data, error } = await sb.rpc('my_shops');
  if (error) { $('loginView').hidden = false; $('loginErr').textContent = error.message; $('loginErr').hidden = false; return; }
  MYSHOPS = data || [];
  if (!MYSHOPS.length) { location.href = '/daftar/?langkah=toko'; return; }
  const want = new URLSearchParams(location.search).get('toko') || store.get('owner_shop');
  const one = MYSHOPS.find(x => x.id === want || x.slug === want) || (MYSHOPS.length === 1 ? MYSHOPS[0] : null);
  if (one) { SET = one; store.set('owner_shop', one.id); return start(); }
  $('pickView').hidden = false;
  $('pickList').innerHTML = MYSHOPS.map(x => `<button type="button" class="btn btn-ghost" data-pick="${x.id}">${esc(x.name)}<small style="display:block;font-weight:600">${esc(x.slug)}</small></button>`).join('');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) { store.set('owner_shop', b.dataset.pick); location.search = ''; } });
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, { error } = await sb.auth.signInWithPassword({ email: f.email.value, password: f.password.value });
  if (error) { $('loginErr').textContent = 'Email atau password salah'; $('loginErr').hidden = false; return; }
  $('loginView').hidden = true; pickShop();
});
$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

async function start() {
  $('appView').hidden = false; $('shopName').textContent = SET.name; $('switchShop').hidden = MYSHOPS.length < 2;
  await Promise.all([loadOrders(true), loadMenu(), loadSettings(), pushState().catch(() => {})]);
  loadPay().then(render);
  render();
  chan = sb.channel('orders-' + SET.id).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: 'shop_id=eq.' + SET.id }, async p => {
    if (p.eventType === 'INSERT') ding();
    await loadOrders(); render();
  }).subscribe();
  setInterval(async () => { await loadOrders(); render(); }, 60000);
}

/* ---------- data ---------- */
async function loadOrders(first) {
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const { data } = await sb.from('orders').select('*').eq('shop_id', SET.id).or(`created_at.gte."${since}",status.in.(baru,dimasak,diantar,siap)`).order('created_at', { ascending: false });
  ORD = data || [];
  if (first) ORD.forEach(o => seen.add(o.id));
  const n = ORD.filter(o => ACTIVE.includes(o.status)).length;
  $('cAktif').textContent = n || ''; document.title = (n ? `(${n}) ` : '') + SET.name;
}
async function loadMenu() { const [a, b] = await Promise.all([sb.from('menu_items').select('*').eq('shop_id', SET.id).order('sort'), sb.from('vouchers').select('*').eq('shop_id', SET.id).order('created_at')]); MENU = a.data || []; VCH = b.data || []; }
async function loadSettings() { const { data } = await sb.from('shops').select('*').eq('id', SET.id).single(); if (data) SET = data; CATS = SET.categories?.length ? [...SET.categories] : ['Makanan', 'Minuman']; $('openToggle').checked = !!SET.is_open; $('shopName').textContent = SET.name; }
async function upd(id, patch) {
  const { error } = await sb.from('orders').update(patch).eq('id', id);
  if (error) return alert('Gagal menyimpan: ' + error.message);
  await loadOrders(); render();
}
$('openToggle').onchange = async e => {
  const { error } = await sb.from('shops').update({ is_open: e.target.checked }).eq('id', SET.id);
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
  if (TAB === 'aktif') { const L = ORD.filter(o => ACTIVE.includes(o.status)); p.innerHTML = onboardHTML() + pushBar() + (L.length ? L.map(card).join('') : '<p class="empty">Belum ada pesanan aktif.</p>'); L.forEach(o => seen.add(o.id)); }
  if (TAB === 'selesai') { const L = ORD.filter(o => !ACTIVE.includes(o.status)); p.innerHTML = L.length ? L.map(card).join('') : '<p class="empty">Belum ada.</p>'; }
  if (TAB === 'menu') p.innerHTML = menuHTML();
  if (TAB === 'rekap') p.innerHTML = rekapHTML();
  if (TAB === 'atur') p.innerHTML = aturHTML();
}
function nextStatus(o) { return { baru: 'dimasak', dimasak: o.method === 'pickup' ? 'siap' : 'diantar', diantar: 'selesai', siap: 'selesai' }[o.status]; }
function custMsg(o) {
  const total = o.subtotal + (o.ongkir || 0) + (o.unique_code || 0), base = shopUrl(), link = `${base}${base.includes('?') ? '&' : '/?'}o=${o.token}`;
  const m = { baru: `Pesanan #${o.code} sudah kami terima`, dimasak: `Pesanan #${o.code} sedang dimasak`, diantar: `Pesanan #${o.code} sedang diantar`, siap: `Pesanan #${o.code} sudah siap diambil${SET.address ? ' di ' + SET.address : ''}`, selesai: `Terima kasih, pesanan #${o.code} selesai`, batal: `Mohon maaf, pesanan #${o.code} dibatalkan` }[o.status];
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
let CATS = ['Makanan', 'Minuman'];
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
    ${isPro() ? '' : '<p class="muted" style="font-size:13px;margin:0">Harga coret &amp; stok harian: fitur paket Pro.</p>'}<div class="grid2"${isPro() ? '' : ' hidden'}><label>Harga coret${opt('promo')}<input name="price_before" type="number" inputmode="numeric" min="0" step="500" value="${m?.price_before ?? ''}" placeholder="20000"></label><label>Stok hari ini${opt('kosong = bebas')}<input name="stock" type="number" inputmode="numeric" min="0" step="1" value="${m?.stock ?? ''}"></label></div>
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
  const { error } = await sb.from('shops').update({ categories: list }).eq('id', SET.id);
  if (error) return alert(error.message);
  if (rename) { const r = await sb.from('menu_items').update({ category: rename[1] }).eq('shop_id', SET.id).eq('category', rename[0]); if (r.error) alert(r.error.message); }
  await Promise.all([loadSettings(), loadMenu()]); render();
}
let VCH = [];
function voucherHTML() {
  if (!isPro()) return proLock('Kode promo');
  return `<div class="card" style="margin-top:16px"><h3>Kode promo</h3><p class="muted" style="font-size:14px;margin:4px 0 8px">Pembeli mengetik kode saat pesan. Bagikan lewat status WA atau Instagram. Centang = aktif.</p>
  ${VCH.map(v => `<div class="mrow"><input type="checkbox" data-vact="${esc(v.code)}" ${v.active ? 'checked' : ''} aria-label="Aktifkan ${esc(v.code)}"><span class="n">${esc(v.code)}<small>${v.kind === 'pct' ? 'potong ' + v.value + '%' : 'potong ' + rp(v.value)}${v.min_order ? ' · min. ' + rp(v.min_order) : ''} · dipakai ${v.used}${v.quota ? '/' + v.quota : ''}×</small></span><button type="button" class="edit" data-vdel="${esc(v.code)}">Hapus</button></div>`).join('')}
  <form class="vform" id="vcForm"><div class="grid2"><label>Kode<input name="code" required maxlength="20" placeholder="HEMAT5" autocapitalize="characters"></label><label>Potongan<input name="amount" type="number" inputmode="numeric" min="1" required placeholder="5000"></label></div>
  <div class="chips" role="radiogroup" aria-label="Jenis potongan"><label class="chip-r"><input type="radio" name="kind" value="rp" checked><span>Rupiah</span></label><label class="chip-r"><input type="radio" name="kind" value="pct"><span>Persen %</span></label></div>
  <div class="grid2"><label>Min. belanja (Rp)<input name="min_order" type="number" inputmode="numeric" min="0" step="1000" value="0"></label><label>Kuota${opt('kosong = bebas')}<input name="quota" type="number" inputmode="numeric" min="1"></label></div>
  <p class="err" id="vcErr" hidden></p><button class="btn btn-red" type="submit">+ Tambah kode promo</button></form></div>`;
}
function menuHTML() {
  return bannerHTML() + voucherHTML() + catHTML() + `<div style="margin-top:16px">${EDIT === 'new' ? menuForm(null) : '<button class="btn btn-red" type="button" data-newmenu>+ Tambah menu</button>'}</div>`
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
  if (!pushOK()) throw new Error(isIOS ? `Di iPhone: pasang dulu ${CONFIG.OWNER_APP} ke Layar Utama (Bagikan → Tambah ke Layar Utama), buka dari ikonnya, lalu coba lagi.` : 'Browser ini belum bisa notifikasi. Buka dashboard di Chrome.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi belum diberikan. Ketuk ikon gembok di samping alamat situs → Notifikasi → Izinkan, lalu coba lagi.');
  await navigator.serviceWorker.register('/sw.js'); const reg = await navigator.serviceWorker.ready;
  // Selalu buat langganan baru yang segar; yang lama dibuang.
  let sub = await reg.pushManager.getSubscription();
  if (sub) { await sb.from('push_subs').delete().eq('endpoint', sub.endpoint); try { await sub.unsubscribe(); } catch {} }
  const { publicKey } = await fetch(PUSH_URL).then(r => r.json());
  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(publicKey) });
  const { error } = await sb.from('push_subs').upsert({ shop_id: SET.id, endpoint: sub.endpoint, sub: sub.toJSON(), ua: devName() }); if (error) throw error;
  MY_EP = sub.endpoint; PUSH_ON = true;
}
const kasirOn = () => PAY?.last_ping && Date.now() - new Date(PAY.last_ping) < 5 * 6e4;
const pushBar = () => PUSH_ON || kasirOn() ? '' : `<div class="card pushbar"><b>Aktifkan bunyi pesanan baru</b><span>Paling mudah: pasang aplikasi ${esc(CONFIG.KASIR_APP)} di HP penjaga (Atur → Lunas otomatis QRIS → Hubungkan HP ini). HP langsung bunyi tiap ada pesanan, walau terkunci. Atau nyalakan notifikasi browser:</span><button type="button" class="btn btn-red" data-push-on>Nyalakan</button>${PUSH_MSG ? `<p class="err">${esc(PUSH_MSG)}</p>` : ''}</div>`;
function pushHTML() {
  return `<div class="card" style="margin-top:16px"><h3>Notifikasi pesanan baru</h3>
  <p class="muted" style="margin:6px 0 12px;font-size:14px">${PUSH_ON ? 'Aktif di HP ini. Tiap pesanan masuk, HP bunyi walau terkunci.' : 'Belum aktif di HP ini.'} <b>Lebih andal:</b> aplikasi ${esc(CONFIG.KASIR_APP)} sudah membunyikan pesanan baru sendiri tanpa setting tambahan. Notifikasi browser di bawah ini cadangan.</p>
  ${PUSH_MSG ? `<p class="err">${esc(PUSH_MSG)}</p>` : ''}
  <div class="acts">${PUSH_ON ? '<button type="button" class="next" data-push-test>Kirim notifikasi tes</button><button type="button" data-push-on>Daftar ulang HP ini</button>' : '<button type="button" class="next" data-push-on>Nyalakan di HP ini</button>'}</div>
  <h4 style="margin:16px 0 4px">Perangkat penerima (${SUBS.length})</h4>
  ${SUBS.length ? SUBS.map(s => `<div class="mrow"><span class="n">${esc(s.ua || 'Perangkat')}${s.endpoint === MY_EP ? ' (HP ini)' : ''}<small>didaftarkan ${jktDate(s.created_at)} ${jktTime(s.created_at)}</small></span><button type="button" class="edit" data-unsub="${esc(s.endpoint)}">Hapus</button></div>`).join('') : '<p class="muted" style="font-size:14px;margin:0">Belum ada. Tekan Nyalakan di tiap HP penjaga warung.</p>'}
  ${isIOS ? `<p class="muted" style="font-size:13px;margin:8px 0 0">iPhone: notifikasi hanya bisa dari aplikasi ${esc(CONFIG.OWNER_APP)} yang dipasang di Layar Utama (bukan dari Safari).</p>` : ''}</div>`;
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
const bnPath = u => decodeURIComponent(String(u).split('/banner/')[1] || '');
function bannerHTML() {
  if (!isPro()) return proLock('Banner promo');
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
  const { error } = await sb.from('shops').update({ banners: list }).eq('id', SET.id);
  if (error) alert(error.message); await loadSettings(); render();
}
async function addBanner(inp) {
  const f = inp.files?.[0]; if (!f) return; const msg = $('bnMsg'); msg.hidden = false; msg.textContent = 'Mengunggah…';
  try {
    const b = await cropBanner(f), ext = b.type === 'image/webp' ? 'webp' : 'jpg', path = `${SET.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('banner').upload(path, b, { contentType: b.type, cacheControl: '31536000' });
    if (error) throw error;
    await saveBanners([...(SET?.banners || []), sb.storage.from('banner').getPublicUrl(path).data.publicUrl]);
  } catch (e) { msg.textContent = 'Gagal: ' + (e.message || e); }
}
let PAY = null, PLOG = [];
async function loadPay() { sb.from('push_subs').select('endpoint, ua, created_at').eq('shop_id', SET.id).order('created_at', { ascending: false }).then(r => { SUBS = r.data || []; if (TAB === 'atur') render(); }); sb.from('blocked_phones').select('*').eq('shop_id', SET.id).order('created_at', { ascending: false }).then(r => { BLK = r.data || []; if (TAB === 'atur') render(); }); const [a, b] = await Promise.all([sb.from('kasir_keys').select('secret, last_ping').eq('shop_id', SET.id).single(), sb.from('pay_log').select('*').eq('shop_id', SET.id).order('at', { ascending: false }).limit(6)]); PAY = a.data; PLOG = b.data || []; }
const cfgText = () => `URL: ${CONFIG.SUPABASE_URL}/rest/v1/rpc/dana_paid\nMethod: POST\nHeader: apikey = ${CONFIG.SUPABASE_ANON_KEY}\nHeader: Content-Type = application/json\nBody: {"p_secret":"${PAY?.secret || ''}","p_text":"[notification]"}`;
const APK = CONFIG.APK;
const linkApp = () => `intent://setup?s=${PAY?.secret || ''}#Intent;scheme=bhatrakasir;package=id.bhatra.kasir;S.browser_fallback_url=${encodeURIComponent(APK)};end`;
function kasirLine() {
  const t = PAY?.last_ping ? new Date(PAY.last_ping) : null, min = t ? Math.round((Date.now() - t) / 6e4) : null;
  if (!t) return '<p class="kasir off">Belum ada kabar dari HP kasir.</p>';
  const ago = min < 1 ? 'baru saja' : min < 60 ? min + ' menit lalu' : jktDate(t) === jktDate(Date.now()) ? 'jam ' + jktTime(t) : jktDate(t) + ' ' + jktTime(t);
  return `<p class="kasir ${min <= 30 ? 'on' : 'off'}">Kabar terakhir dari HP kasir: <b>${ago}</b>${min > 30 ? '. Kalau ada QRIS yang tidak lunas otomatis, buka aplikasi ${esc(CONFIG.KASIR_APP)} di HP itu dan pastikan statusnya AKTIF.' : ''}</p>`;
}
function payHTML() {
  if (!isPro()) return proLock('Lunas otomatis QRIS &amp; bunyi pesanan (aplikasi Kasir)');
  return `<div class="card" style="margin-top:16px"><h3>Lunas otomatis QRIS &amp; bunyi pesanan</h3>
  <p class="muted" style="margin:6px 0 12px;font-size:14px">Pembeli QRIS membayar dengan kode unik (mis. Rp32.017). HP Android penjaga warung membaca notifikasi uang masuk dari DANA, lalu pesanan dengan nominal yang sama otomatis Lunas. Aplikasi yang sama juga membunyikan HP tiap ada pesanan baru.</p>
  <ol style="margin:0 0 12px;padding-left:20px;display:grid;gap:6px;font-size:14px">
    <li>Di HP Android penjaga warung, <a href="${APK}" style="font-weight:800">unduh &amp; install ${esc(CONFIG.KASIR_APP)}</a>.</li>
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
  return `<form class="card" id="setForm" style="margin-top:16px">
    <h3>Pengaturan warung</h3>
    <label class="opt"><input type="checkbox" name="is_open" ${s.is_open ? 'checked' : ''}><span><b>Warung buka</b><small>Matikan saat libur atau bahan habis. Pembeli tidak bisa pesan.</small></span></label>
    <label class="opt"><input type="checkbox" name="full24" ${full ? 'checked' : ''}><span><b>Buka 24 jam</b><small>Pembeli bisa pesan kapan saja</small></span></label>
    <div class="grid2"${full ? ' hidden' : ''} id="hoursRow"><label>Jam buka<input type="time" name="open_time" value="${t(s.open_time)}"></label><label>Jam tutup<input type="time" name="close_time" value="${t(s.close_time)}"></label></div>
    <p class="muted" style="font-size:13px;margin-top:-6px"${full ? ' hidden' : ''} id="hoursHint">Boleh lewat tengah malam, misal 16.00 – 02.00.</p>
    <label class="opt"><input type="checkbox" name="delAll" ${delAll ? 'checked' : ''}><span><b>Antar &amp; COD selama warung buka</b><small>Matikan kalau antar hanya sampai jam tertentu</small></span></label>
    <div id="delRow" class="grid2"${delAll ? ' hidden' : ''}><label>Antar &amp; COD mulai<input type="time" name="delivery_from" value="${t(s.delivery_from || s.open_time)}"></label><label>sampai<input type="time" name="delivery_until" value="${t(s.delivery_until)}"></label></div>
    <fieldset><legend>Lokasi warung (untuk hitung jarak)</legend>
      <p class="muted" style="margin:0 0 8px;font-size:14px">${s.shop_lat != null ? `Tersimpan · <a href="https://maps.google.com/?q=${s.shop_lat},${s.shop_lng}" target="_blank" rel="noopener">cek di Maps</a>` : 'Belum diatur. Tekan tombol ini saat sedang di warung.'}</p>
      <button type="button" class="btn btn-ghost" data-shoploc>Pakai lokasi saya sekarang</button>
    </fieldset>
    <label>Jangkauan antar maksimal (km)<input type="number" name="max_km" inputmode="decimal" min="0" step="0.5" value="${s.max_km ?? 10}"></label>
    <label>Ongkir per km (Rp)<input type="number" name="ongkir_per_km" inputmode="numeric" min="0" step="500" value="${s.ongkir_per_km ?? 1000}" required></label>
    <label>Gratis ongkir mulai belanja (Rp) <span class="muted" style="font-weight:600">(0 = tidak ada)</span><input type="number" name="free_ongkir_min" inputmode="numeric" min="0" step="1000" value="${s.free_ongkir_min ?? 0}"></label>
    <label>Lama siapkan pesanan (menit)<input type="number" name="prep_min" inputmode="numeric" min="5" max="180" step="5" value="${s.prep_min ?? 20}" required></label>
    <p class="note" id="setMsg" hidden></p>
    <button class="btn btn-red" type="submit">Simpan pengaturan</button>
  </form>
  ${profileHTML()}
  ${themeHTML()}
  ${qrisHTML()}
  ${pushHTML()}
  ${payHTML()}
  ${blockHTML()}
  ${planHTML()}
  <div class="card" style="margin:16px 0 32px"><h3>Link toko</h3><p class="muted" style="margin:6px 0 12px">Bagikan ke WA, status, dan bio Instagram.</p>
    <p style="font-weight:800;margin:0 0 12px;word-break:break-all">${esc(shopUrl())}</p>
    <div class="acts"><button type="button" class="next" data-copy>Salin link</button><a href="${esc(shopUrl())}" target="_blank" rel="noopener">Buka toko</a><button type="button" data-install>Pasang ${esc(CONFIG.OWNER_APP)} di HP</button><a class="wa" data-share target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Pesan ' + SET.name + ' online di ' + shopUrl())}">Bagikan ke WA</a></div></div>`;
}
let RK = { days: 1, rows: null };
async function loadRekap() {
  const start = new Date(new Date(jktDate(Date.now()) + 'T00:00:00+07:00').getTime() - (RK.days - 1) * 864e5).toISOString();
  const { data } = await sb.from('orders').select('*').eq('shop_id', SET.id).gte('created_at', start).order('created_at', { ascending: false }).limit(5000);
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
  const chips = `<div class="chips" style="margin-top:16px" role="group" aria-label="Periode">${[[1, 'Hari ini'], [7, '7 hari'], [30, '30 hari']].map(([d, t]) => `<button type="button" class="chip" data-rk="${d}" aria-pressed="${RK.days === d}">${t}</button>`).join('')}</div>`;
  if (RK.days > 1 && !isPro()) return chips + proLock('Rekap 7 &amp; 30 hari + unduh Excel');
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
  <div class="acts" style="margin-top:12px"><button type="button" class="next" data-csv>Unduh Excel (${L.length} pesanan)</button></div>
  <p class="muted" style="margin:12px 0 32px">Angka dihitung dari pesanan berstatus Selesai, ${label}. Batal: ${L.filter(o => o.status === 'batal').length}. File unduhan berisi semua pesanan di periode ini dan bisa dibuka di Excel atau Google Sheets.</p>`;
}
function struk(o) {
  const L = o.items.map(i => `${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''} — ${rp(i.price * i.qty)}`).join('\n');
  const total = o.subtotal + (o.ongkir || 0) + (o.unique_code || 0);
  return `*STRUK ${SET.name.toUpperCase()}*\n#${o.code} · ${jktDate(o.created_at)} ${jktTime(o.created_at)}\n${o.name}\n------------------------\n${L}\n------------------------${o.discount ? `\nDiskon ${o.voucher || ''}: -${rp(o.discount)}` : ''}\nSubtotal: ${rp(o.subtotal)}${o.ongkir ? `\nOngkir: ${rp(o.ongkir)}` : ''}${o.unique_code ? `\nKode unik QRIS: ${rp(o.unique_code)}` : ''}\n*Total: ${rp(total)}*\n${METHOD[o.method]} · ${o.payment === 'qris' ? 'QRIS' : 'Tunai'} · ${o.paid ? 'LUNAS' : 'Belum bayar'}\n\nTerima kasih! Pesan lagi di ${shopUrl()}`;
}
$('panel').addEventListener('click', e => {
  const gt = e.target.closest('[data-goto]'); if (gt) { document.querySelector(`.tabs [data-tab="${gt.dataset.goto}"]`)?.click(); return; }
  const tp = e.target.closest('[data-theme-pick]'); if (tp) { saveTheme({ preset: tp.dataset.themePick }); return; }
  const ts = e.target.closest('[data-theme-set]'); if (ts) { const [k, v] = ts.dataset.themeSet.split('|'); saveTheme({ [k]: v }); return; }
  if (e.target.closest('[data-theme-logo]')) { logoColor().then(c => c ? saveTheme({ primary: c }) : toast('Warna logo tidak terbaca')).catch(() => toast('Warna logo tidak terbaca')); return; }
  if (e.target.closest('[data-onb-x]')) { store.set('onb_x_' + SET.id, '1'); return render(); }
  if (e.target.closest('[data-share]')) store.set('shared_' + SET.id, '1');
  if (e.target.closest('[data-logo-del]')) { (async () => { await sb.from('shops').update({ logo_url: null }).eq('id', SET.id); await loadSettings(); render(); })(); return; }
  if (e.target.closest('[data-qris-del]')) { if (!confirm('Hapus QRIS? Pembeli hanya bisa bayar tunai sampai QRIS diunggah lagi.')) return; (async () => { await sb.from('shops').update({ qris_payload: null, qris_merchant: null }).eq('id', SET.id); await loadSettings(); render(); })(); return; }
  const s = e.target.closest('[data-st]'); if (s) { const [id, st] = s.dataset.st.split('|'); if (st === 'batal' && !confirm('Batalkan pesanan ini?')) return; return upd(id, { status: st }); }
  const pd = e.target.closest('[data-paid]'); if (pd) { const [id, v] = pd.dataset.paid.split('|'); return upd(id, { paid: v === 'true' }); }
  if (e.target.closest('[data-newmenu]')) { EDIT = 'new'; return render(); }
  const ed = e.target.closest('[data-edit]'); if (ed) { EDIT = +ed.dataset.edit; return render(); }
  if (e.target.closest('[data-cancel]')) { EDIT = null; return render(); }
  if (e.target.closest('[data-push-on]')) { PUSH_MSG = ''; pushEnable().catch(x => { PUSH_MSG = x.message || String(x); }).finally(render); return; }
  const pt = e.target.closest('[data-push-test]');
  if (pt) { pt.disabled = true; pt.textContent = 'Mengirim…'; sb.rpc('push_test', { p_shop: SET.id }).then(({ error }) => { pt.textContent = error ? 'Gagal: ' + error.message : `Terkirim ke ${SUBS.length} perangkat. Cek notifikasi.`; }); return; }
  const bk = e.target.closest('[data-block]');
  if (bk) { const o = ORD.find(x => String(x.id) === bk.dataset.block); if (!o) return; const ph = normPhone(o.phone), act = ACTIVE.includes(o.status);
    if (!confirm(`Blokir ${ph}? Nomor ini tidak bisa pesan online lagi${act ? ' dan pesanan ini dibatalkan' : ''}.`)) return;
    (async () => { const { error } = await sb.from('blocked_phones').upsert({ shop_id: SET.id, phone: ph, note: o.name }); if (error) return alert(error.message); if (act) await upd(o.id, { status: 'batal' }); alert('Nomor diblokir. Bisa dibuka lagi di Atur.'); })(); return; }
  const us = e.target.closest('[data-unsub]');
  if (us) { (async () => { await sb.from('push_subs').delete().eq('endpoint', us.dataset.unsub); if (us.dataset.unsub === MY_EP) PUSH_ON = false; await loadPay(); render(); })(); return; }
  const ub = e.target.closest('[data-unblock]');
  if (ub) { (async () => { await sb.from('blocked_phones').delete().eq('shop_id', SET.id).eq('phone', ub.dataset.unblock); BLK = BLK.filter(b => b.phone !== ub.dataset.unblock); render(); })(); return; }
  const bu = e.target.closest('[data-bup]'); if (bu) { const i = +bu.dataset.bup, l = [...(SET?.banners || [])]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return saveBanners(l); }
  const bd = e.target.closest('[data-bdel]');
  if (bd) { const B = SET?.banners || [], u = B[+bd.dataset.bdel]; if (!confirm('Hapus banner ini?')) return; (async () => { await sb.storage.from('banner').remove([bnPath(u)]); saveBanners(B.filter(x => x !== u)); })(); return; }
  const rk = e.target.closest('[data-rk]'); if (rk) { RK.days = +rk.dataset.rk; RK.rows = null; return render(); }
  if (e.target.closest('[data-csv]')) return rekapCSV();
  const ft = e.target.closest('[data-feat]');
  if (ft) { const m = MENU.find(x => x.id === +ft.dataset.feat); if (!m) return; (async () => { const { error } = await sb.from('menu_items').update({ featured: !m.featured }).eq('id', m.id); if (error) alert(error.message); await loadMenu(); render(); })(); return; }
  const mu = e.target.closest('[data-mup]');
  if (mu) { const m = MENU.find(x => x.id === +mu.dataset.mup); if (!m) return; const L = MENU.filter(x => x.category === m.category), i = L.indexOf(m); if (i < 1) return;
    const arr = [...L]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; const base = Math.min(...L.map(x => x.sort));
    (async () => { await Promise.all(arr.map((x, j) => x.sort !== base + j ? sb.from('menu_items').update({ sort: base + j }).eq('id', x.id) : null)); await loadMenu(); render(); })(); return; }
  const vd = e.target.closest('[data-vdel]');
  if (vd) { if (!confirm(`Hapus kode promo ${vd.dataset.vdel}?`)) return; (async () => { await sb.from('vouchers').delete().eq('shop_id', SET.id).eq('code', vd.dataset.vdel); await loadMenu(); render(); })(); return; }
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
    navigator.geolocation.getCurrentPosition(async p => { const { error } = await sb.from('shops').update({ shop_lat: p.coords.latitude, shop_lng: p.coords.longitude }).eq('id', SET.id); if (error) alert(error.message); await loadSettings(); render(); },
      () => { sl.disabled = false; sl.textContent = 'Pakai lokasi saya sekarang'; alert('Izinkan akses lokasi di browser lalu coba lagi.'); }, { enableHighAccuracy: true, timeout: 15000 }); return; }
  if (e.target.closest('[data-copycfg]')) { navigator.clipboard?.writeText(cfgText()).then(() => { e.target.textContent = 'Tersalin ✓'; }); return; }
  if (e.target.closest('[data-copy]')) { store.set('shared_' + SET.id, '1'); navigator.clipboard?.writeText(shopUrl()).then(() => { e.target.textContent = 'Tersalin ✓'; }); }
});
$('panel').addEventListener('submit', async e => {
  if (e.target.id === 'profileForm') {
    e.preventDefault(); const f = e.target, msg = $('profileMsg'), wa = normPhone(f.wa.value);
    if (!/^08\d{7,12}$/.test(wa)) { msg.hidden = false; msg.textContent = 'Nomor WA belum benar (contoh 0812xxxxxxx).'; return; }
    const { error } = await sb.from('shops').update({ name: f.name.value.trim(), tagline: f.tagline.value.trim() || null, about: f.about.value.trim() || null, wa: '62' + wa.slice(1), address: f.address.value.trim() || null }).eq('id', SET.id);
    msg.hidden = false; msg.textContent = error ? 'Gagal: ' + error.message : 'Tersimpan ✓';
    if (!error) { await loadSettings(); } return;
  }
  if (e.target.id === 'vcForm') {
    e.preventDefault(); const f = e.target, err = $('vcErr');
    const row = { shop_id: SET.id, code: f.code.value.trim().toUpperCase().replace(/\s+/g, ''), kind: f.kind.value, value: parseInt(f.amount.value, 10), min_order: parseInt(f.min_order.value, 10) || 0, quota: parseInt(f.quota.value, 10) || null };
    if (!/^[A-Z0-9]{3,20}$/.test(row.code)) { err.textContent = 'Kode 3–20 huruf/angka, tanpa spasi.'; err.hidden = false; return; }
    if (!(row.value > 0) || (row.kind === 'pct' && row.value > 100)) { err.textContent = 'Isi potongan dengan benar (persen maksimal 100).'; err.hidden = false; return; }
    const { error } = await sb.from('vouchers').insert(row);
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
      variants: f.variants.value.split(',').map(x => x.trim()).filter(Boolean), unit: f.unit.value.trim(), price_before: parseInt(f.price_before.value, 10) || null, stock: f.stock.value === '' ? null : Math.max(0, parseInt(f.stock.value, 10) || 0) };
    if (!row.name || !(row.price >= 0)) { err.textContent = 'Nama dan harga wajib diisi'; err.hidden = false; return; }
    let r;
    if (id === 'new') { row.shop_id = SET.id; row.sort = Math.max(0, ...MENU.filter(m => m.category === row.category).map(m => m.sort)) + 1 || CATS.indexOf(row.category) * 10; r = await sb.from('menu_items').insert(row); }
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
    const { error } = await sb.from('shops').update(patch).eq('id', SET.id);
    msg.hidden = false; msg.textContent = error ? 'Gagal: ' + error.message : 'Tersimpan. Halaman pembeli langsung ikut berubah.';
    if (!error) await loadSettings(); return;
  }
  const f = e.target.closest('[data-km]'); if (!f) return; e.preventDefault();
  const km = Math.round(parseFloat(f.km.value.replace(',', '.')) * 10) / 10; if (!(km >= 0)) return;
  const od = ORD.find(x => String(x.id) === String(f.dataset.km)), free = +SET?.free_ongkir_min > 0 && (od?.subtotal || 0) >= +SET.free_ongkir_min;
  upd(f.dataset.km, { distance_km: km, ongkir: free ? 0 : Math.ceil(km * (SET?.ongkir_per_km || 1000) / 500) * 500 });
});
$('panel').addEventListener('change', async e => {
  if (e.target.id === 'bnFile') return addBanner(e.target);
  if (e.target.id === 'logoFile') return uploadLogo(e.target);
  if (e.target.id === 'thColor') return saveTheme({ primary: e.target.value });
  if (e.target.id === 'qrisFile') return readQris(e.target);
  if (e.target.dataset.vact) { const { error } = await sb.from('vouchers').update({ active: e.target.checked }).eq('shop_id', SET.id).eq('code', e.target.dataset.vact); if (error) alert(error.message); await loadMenu(); return; }
  if (e.target.name === 'full24') { $('hoursRow').hidden = e.target.checked; $('hoursHint').hidden = e.target.checked; return; }
  if (e.target.name === 'delAll') { $('delRow').hidden = e.target.checked; return; }
  const av = e.target.dataset.av, pr = e.target.dataset.price;
  if (av) { const { error } = await sb.from('menu_items').update({ available: e.target.checked }).eq('id', av); if (error) alert(error.message); await loadMenu(); render(); }
  if (pr) { const v = parseInt(e.target.value, 10); if (v >= 0) { const { error } = await sb.from('menu_items').update({ price: v }).eq('id', pr); if (error) alert(error.message); await loadMenu(); } }
});

/* ---------- profil toko, QRIS, paket (v2 banyak warung) ---------- */
// Daftar langkah untuk toko baru, tampil di tab Aktif sampai semua selesai atau disembunyikan.
function onboardHTML() {
  if (store.get('onb_x_' + SET.id)) return '';
  const steps = [
    ['Isi profil toko (slogan atau logo)', !!(SET.tagline || SET.logo_url), 'atur'],
    ['Tambah menu pertama', MENU.length > 0, 'menu'],
    ['Pasang lokasi warung & jam buka', SET.shop_lat != null, 'atur'],
    ['Unggah QRIS (kalau punya)', !!SET.qris_payload, 'atur'],
    ['Bagikan link toko ke pelanggan', !!store.get('shared_' + SET.id), 'atur']];
  const done = steps.filter(x => x[1]).length;
  if (done === steps.length) return '';
  return `<div class="card onb" style="margin-top:16px"><h3>Siapkan toko · ${done}/${steps.length}</h3><ol>${steps.map(([t, ok, tab]) => `<li class="${ok ? 'ok' : ''}"><button type="button" data-goto="${tab}">${ok ? '✓ ' : ''}${t}</button></li>`).join('')}</ol><button type="button" class="linkbtn" data-onb-x>Sembunyikan daftar ini</button></div>`;
}
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 2400); }
const waLocal = w => w ? '0' + String(w).replace(/^62/, '') : '';
function profileHTML() {
  const s = SET;
  return `<form class="card" id="profileForm" style="margin-top:16px"><h3>Profil toko</h3>
    <div class="logo-row">${s.logo_url ? `<img src="${esc(s.logo_url)}" alt="Logo toko" class="logo-prev">` : '<div class="logo-prev empty">Logo</div>'}
      <label class="btn btn-ghost" for="logoFile">${s.logo_url ? 'Ganti logo' : '+ Unggah logo'}</label><input type="file" id="logoFile" accept="image/*" hidden>
      ${s.logo_url ? '<button type="button" class="edit" data-logo-del>Hapus</button>' : ''}</div>
    <label>Nama toko<input name="name" required minlength="2" maxlength="60" value="${esc(s.name)}"></label>
    <label>Slogan${opt('tampil besar di atas')}<input name="tagline" maxlength="80" value="${esc(s.tagline || '')}" placeholder="Contoh: Dari dapur Bhre &amp; Trah"></label>
    <label>Keterangan singkat${opt('opsional')}<input name="about" maxlength="120" value="${esc(s.about || '')}" placeholder="Contoh: Masakan rumahan, harga pelajar."></label>
    <label>Nomor WhatsApp toko<input name="wa" type="tel" inputmode="tel" required value="${esc(waLocal(s.wa))}" placeholder="08xxxxxxxxxx"></label>
    <label>Alamat / patokan untuk ambil di tempat<input name="address" maxlength="160" value="${esc(s.address || '')}" placeholder="Contoh: Jl. Melati 5, depan masjid"></label>
    <p class="note" id="profileMsg" hidden></p>
    <button class="btn btn-red" type="submit">Simpan profil</button></form>`;
}
// ---------- Tampilan toko ----------
function themeCard(k, cur) {
  const t = THEMES[k], f = FONTS[t.font], v = t.v;
  return `<button type="button" class="th-card${cur === k ? ' on' : ''}" data-theme-pick="${k}" aria-pressed="${cur === k}" style="--c:${v.cream};--k:${v.ink};--a:${v.red};--b:${v.butter};--l:${v.line};font-family:'${f.b}',sans-serif">
    <span class="th-hero"><b style="font-family:'${f.d}',sans-serif">Aa</b><i></i></span><span class="th-name">${t.name}</span><span class="th-note">${t.note}</span></button>`;
}
function themeHTML() {
  loadAllThemeFonts();
  const t = SET.theme || {}, cur = THEMES[t.preset] ? t.preset : 'hangat', r = resolveTheme(t), pro = isPro();
  const chips = (obj, key, val) => Object.entries(obj).map(([k, o]) => `<button type="button" class="chip" data-theme-set="${key}|${k}" aria-pressed="${val === k}">${typeof o === 'string' ? o : o.name}</button>`).join('');
  return `<div class="card" style="margin-top:16px" id="themeBox"><h3>Tampilan toko</h3>
    <p class="muted" style="font-size:14px;margin:4px 0 12px">Pilih gaya yang cocok dengan warung. Langsung berlaku di halaman pembeli.</p>
    <div class="th-grid">${Object.keys(THEMES).map(k => themeCard(k, cur)).join('')}</div>
    ${pro ? `<div class="th-pro"><p class="lbl">Warna utama</p>
      <div class="th-row"><input type="color" id="thColor" value="${r.vars.red}" aria-label="Warna utama">
        ${SET.logo_url ? '<button type="button" class="chip" data-theme-logo>Ambil dari logo</button>' : ''}
        ${t.primary ? '<button type="button" class="chip" data-theme-set="primary|">Warna bawaan</button>' : ''}</div>
      <p class="lbl">Jenis huruf</p><div class="th-row">${chips(FONTS, 'font', r.font)}</div>
      <p class="lbl">Latar</p><div class="th-row">${chips(PATTERNS, 'pattern', r.pattern)}</div></div>`
    : '<p class="muted" style="font-size:13px;margin:12px 0 0">Warna sendiri, jenis huruf, dan pola latar: fitur paket Pro.</p>'}
    <div class="th-row" style="margin-top:14px"><a class="btn btn-ghost btn-sm" href="${esc(window.shopLink(SET))}" target="_blank" rel="noopener">Lihat toko</a>
      <a class="linkbtn" href="https://wa.me/${CONFIG.SUPPORT_WA}?text=${encodeURIComponent('Halo, saya mau pesan desain khusus untuk toko ' + SET.name + ' (' + SET.slug + ').')}" target="_blank" rel="noopener">Mau desain khusus (maskot, ilustrasi)?</a></div></div>`;
}
async function saveTheme(patch) {
  const next = { ...(SET.theme || {}), ...patch }; Object.keys(next).forEach(k => { if (next[k] === '' || next[k] == null) delete next[k]; });
  const { error } = await sb.from('shops').update({ theme: next }).eq('id', SET.id);
  if (error) return alert(error.message); await loadSettings(); render(); toast('Tampilan tersimpan ✓');
}
// Warna dominan dari logo (abaikan putih, hitam, dan abu-abu).
async function logoColor() {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = SET.logo_url; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data, bins = {};
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (a < 200 || mx < 40 || mn > 225 || mx - mn < 40) continue;
    const k = [r, g, b].map(v => v >> 5).join(); (bins[k] ||= { n: 0, r: 0, g: 0, b: 0 }); const o = bins[k]; o.n++; o.r += r; o.g += g; o.b += b;
  }
  const best = Object.values(bins).sort((a, b) => b.n - a.n)[0]; if (!best) return null;
  return '#' + [best.r, best.g, best.b].map(v => Math.round(v / best.n).toString(16).padStart(2, '0')).join('');
}
async function uploadLogo(inp) {
  const f = inp.files?.[0]; if (!f) return; const msg = $('profileMsg'); msg.hidden = false; msg.textContent = 'Mengunggah logo…';
  try {
    const img = await createImageBitmap(f), S = 512, r = Math.min(1, S / img.width, S / img.height), w = Math.round(img.width * r), h = Math.round(img.height * r);
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
    let b = await new Promise(res => c.toBlob(res, 'image/webp', 0.9)); if (!b || b.type !== 'image/webp') b = await new Promise(res => c.toBlob(res, 'image/png'));
    const path = `${SET.id}/logo-${Date.now()}.${b.type === 'image/webp' ? 'webp' : 'png'}`;
    const up = await sb.storage.from('banner').upload(path, b, { contentType: b.type, cacheControl: '31536000' }); if (up.error) throw up.error;
    const r2 = await sb.from('shops').update({ logo_url: sb.storage.from('banner').getPublicUrl(path).data.publicUrl }).eq('id', SET.id); if (r2.error) throw r2.error;
    await loadSettings(); render(); toast('Logo tersimpan ✓');
  } catch (e) { msg.textContent = 'Gagal: ' + (e.message || e); }
}
function qrisHTML() {
  const s = SET;
  return `<div class="card" style="margin-top:16px"><h3>QRIS toko</h3>
    ${s.qris_payload ? `<p class="kasir on">Aktif · ${esc(s.qris_merchant || 'QRIS')}</p><p class="muted" style="font-size:14px;margin:8px 0">Pembeli yang memilih QRIS mendapat kode QR dengan nominal terisi otomatis.</p>`
      : '<p class="muted" style="font-size:14px;margin:6px 0 10px">Belum ada. Unggah foto atau screenshot QRIS statis toko (dari DANA Bisnis, GoPay Merchant, ShopeePay, bank, dll). Sebelum diunggah, pembeli hanya bisa bayar tunai.</p>'}
    <div class="acts"><label class="next" for="qrisFile" style="cursor:pointer">${s.qris_payload ? 'Ganti QRIS' : '+ Unggah QRIS'}</label><input type="file" id="qrisFile" accept="image/*" hidden>${s.qris_payload ? '<button type="button" class="danger" data-qris-del>Hapus QRIS</button>' : ''}</div>
    <p class="note" id="qrisMsg" hidden></p></div>`;
}
async function readQris(inp) {
  const f = inp.files?.[0]; if (!f) return; const msg = $('qrisMsg'); msg.hidden = false; msg.textContent = 'Membaca QRIS…';
  try {
    if (!window.jsQR) throw new Error('Pembaca QR belum termuat. Muat ulang halaman lalu coba lagi.');
    const img = await createImageBitmap(f); let code = null;
    for (const S of [1600, 1000, 700, 450]) {
      const r = Math.min(1, S / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
      code = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'attemptBoth' }); if (code) break;
    }
    const p = qrisCheck(code ? code.data : '');
    const { error } = await sb.from('shops').update({ qris_payload: p.payload, qris_merchant: p.merchant }).eq('id', SET.id); if (error) throw error;
    await loadSettings(); render(); toast(`QRIS ${p.merchant} tersimpan ✓`);
  } catch (e) { msg.textContent = e.message || String(e); }
}
// Validasi isi QRIS: harus QRIS Indonesia, statis (tanpa nominal), dan kode cek (CRC) benar.
function qrisCheck(raw) {
  const p = String(raw || '').trim();
  if (!p) throw new Error('QR tidak terbaca. Pakai foto yang lebih jelas atau screenshot QRIS dari aplikasinya.');
  let tl; try { tl = Object.fromEntries(qrisTlv(p)); } catch { tl = {}; }
  if (!p.startsWith('000201') || !tl['59'] || tl['58'] !== 'ID' || !tl['63']) throw new Error('Ini bukan kode QRIS. Pastikan yang diunggah QRIS toko.');
  if (qrisCrc(p.slice(0, -4)) !== p.slice(-4).toUpperCase()) throw new Error('Kode QRIS rusak. Coba foto ulang.');
  if (tl['54']) throw new Error('Ini QRIS dengan nominal tetap. Unggah QRIS statis (yang tanpa nominal).');
  return { payload: p, merchant: tl['59'] };
}
function planHTML() {
  const s = SET, P = CONFIG.PRICES, until = d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const status = s.suspended ? 'Dibekukan' : s.plan === 'trial' ? `Masa coba gratis sampai ${until(s.trial_until)}` : `Paket ${s.plan === 'pro' ? 'Pro' : 'Dasar'}${s.paid_until ? ' · aktif sampai ' + until(s.paid_until) : ''}`;
  const msg = p => encodeURIComponent(`Halo, saya mau bayar langganan ${CONFIG.PRODUCT} paket ${p} untuk toko ${s.name} (${s.slug}).`);
  return `<div class="card" style="margin-top:16px"><h3>Paket</h3><p class="kasir ${isActive() ? 'on' : 'off'}">${esc(status)}${isActive() ? '' : ' · toko tidak menerima pesanan online'}</p>
    <div class="plans">
      <div><b>Dasar</b><span>${rp(P.dasar)}/bulan</span><small>Toko online, pesanan, ongkir otomatis, tunai &amp; QRIS (cek manual), rekap harian</small><a class="wa" href="https://wa.me/${CONFIG.SUPPORT_WA}?text=${msg('Dasar')}" target="_blank" rel="noopener">Bayar Dasar</a></div>
      <div><b>Pro</b><span>${rp(P.pro)}/bulan</span><small>+ QRIS lunas otomatis, bunyi pesanan di HP, promo, stok, banner, rekap 30 hari</small><a class="wa" href="https://wa.me/${CONFIG.SUPPORT_WA}?text=${msg('Pro')}" target="_blank" rel="noopener">Bayar Pro</a></div>
    </div>
    <p class="muted" style="font-size:13px;margin:8px 0 0">Bayar tahunan gratis 2 bulan. Tanpa potongan per pesanan. Setelah bayar, paket aktif paling lambat 1×24 jam.</p></div>`;
}
$('switchShop').onclick = () => { store.set('owner_shop', ''); location.reload(); };
$('forgotPw').onclick = async e => {
  e.preventDefault(); const em = $('loginForm').email.value.trim(), el = $('loginErr');
  if (!em) { el.textContent = 'Isi email dulu, lalu tekan Lupa password.'; el.hidden = false; return; }
  const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + '/owner/?reset=1' });
  el.textContent = error ? 'Gagal: ' + error.message : 'Cek email untuk link ganti password.'; el.hidden = false;
};
sb.auth.onAuthStateChange(async ev => {
  if (ev !== 'PASSWORD_RECOVERY') return;
  const pw = prompt('Ketik password baru (minimal 8 karakter):');
  if (!pw || pw.length < 8) return alert('Password tidak diganti.');
  const { error } = await sb.auth.updateUser({ password: pw });
  alert(error ? 'Gagal: ' + error.message : 'Password diganti ✓');
});
init();
