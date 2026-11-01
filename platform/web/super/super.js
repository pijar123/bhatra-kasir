const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const ms = d => d ? new Date(d).getTime() : -Infinity;
let ROWS = [], F = 'semua', OPEN = null;

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  session ? load() : ($('loginView').hidden = false);
}
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value, password: f.password.value });
  if (error) { $('loginErr').textContent = 'Email atau password salah'; $('loginErr').hidden = false; return; }
  $('loginView').hidden = true; load();
});
$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

async function load() {
  const { data, error } = await sb.rpc('admin_shops');
  if (error) { document.body.innerHTML = `<main class="wrap"><div class="card" style="margin-top:48px"><h1>Bukan admin</h1><p>${esc(error.message)}</p></div></main>`; return; }
  ROWS = data || []; $('appView').hidden = false; render();
}
const kind = r => ms(r.paid_until) > Date.now() ? 'bayar' : ms(r.trial_until) > Date.now() ? 'coba' : 'habis';
function render() {
  const now = Date.now(), paid = ROWS.filter(r => kind(r) === 'bayar');
  const mrr = paid.reduce((a, r) => a + CONFIG.PRICE[r.plan], 0);
  const L = ROWS.filter(r => F === 'semua' || kind(r) === F);
  $('panel').innerHTML = `<div class="kpis">
      <div class="stat"><p>Toko</p><b>${ROWS.length}</b></div>
      <div class="stat"><p>Berbayar</p><b>${paid.length}</b></div>
      <div class="stat"><p>Masa coba</p><b>${ROWS.filter(r => kind(r) === 'coba').length}</b></div>
      <div class="stat"><p>Pendapatan / bulan</p><b>${rp(mrr)}</b></div></div>`
    + (L.length ? L.map(row).join('') : '<p class="empty">Belum ada.</p>');
}
function remind(r) {
  const k = kind(r), url = location.hostname.endsWith(CONFIG.ROOT) ? `https://${r.slug}.${CONFIG.ROOT}` : `${location.origin}/?toko=${r.slug}`;
  const t = k === 'coba' ? `Halo ${r.name}, masa coba ${CONFIG.BRAND} untuk toko ${url} berakhir ${fmt(r.trial_until)}. Supaya pesanan online tidak terputus, langganan Dasar ${rp(CONFIG.PRICE.dasar)} atau Pro ${rp(CONFIG.PRICE.pro)} per bulan. Mau dibantu?`
    : k === 'bayar' ? `Halo ${r.name}, langganan ${CONFIG.BRAND} toko ${url} aktif sampai ${fmt(r.paid_until)}. Terima kasih sudah memakai ${CONFIG.BRAND}!`
    : `Halo ${r.name}, pesan online toko ${url} sedang nonaktif karena masa aktif habis. Balas pesan ini kalau mau diaktifkan lagi.`;
  return `https://wa.me/${r.wa}?text=${encodeURIComponent(t)}`;
}
function row(r) {
  const k = kind(r), badge = { bayar: `<span class="b ok">${r.plan === 'pro' ? 'Pro' : 'Dasar'} s.d. ${fmt(r.paid_until)}</span>`, coba: `<span class="b gold">Coba s.d. ${fmt(r.trial_until)}</span>`, habis: `<span class="b red">Habis</span>` }[k];
  const ping = r.last_ping ? `Kasir terakhir ${fmt(r.last_ping)}` : 'Kasir belum terhubung';
  return `<article class="card shoprow" style="margin-top:12px">
    <div class="top2"><h3>${esc(r.name)}</h3><span class="muted">${esc(r.slug)} · daftar ${fmt(r.created_at)}</span></div>
    <div class="badges">${badge}<span class="b">${r.orders_30d} pesanan / 30 hari</span><span class="b">${ping}</span></div>
    <p class="muted" style="margin:0;font-size:14px">${esc(r.owner_email || '')} · WA ${esc(r.wa.replace(/^62/, '0'))}${r.last_order ? ' · pesanan terakhir ' + fmt(r.last_order) : ''}</p>
    <div class="acts"><a class="wa" target="_blank" rel="noopener" href="${remind(r)}">Kirim pengingat WA</a><button type="button" class="next" data-ext="${r.id}">Catat pembayaran</button></div>
    ${OPEN === r.id ? `<form class="ext" data-form="${r.id}">
      <select name="plan"><option value="dasar" ${r.plan === 'dasar' ? 'selected' : ''}>Dasar</option><option value="pro" ${r.plan !== 'dasar' ? 'selected' : ''}>Pro</option></select>
      <select name="months"><option value="1">1 bulan</option><option value="3">3 bulan</option><option value="6">6 bulan</option><option value="12">12 bulan (bayar 10)</option></select>
      <input name="amount" type="number" inputmode="numeric" placeholder="Jumlah dibayar (Rp)">
      <input name="note" placeholder="Catatan, mis. transfer BCA">
      <button class="btn btn-red" type="submit">Simpan &amp; perpanjang</button></form>` : ''}
  </article>`;
}
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  F = b.dataset.f; document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); render();
});
$('panel').addEventListener('click', e => { const x = e.target.closest('[data-ext]'); if (x) { OPEN = OPEN === x.dataset.ext ? null : x.dataset.ext; render(); } });
$('panel').addEventListener('change', e => {
  const f = e.target.closest('form[data-form]'); if (!f || !['plan', 'months'].includes(e.target.name)) return;
  const m = +f.months.value; f.amount.value = CONFIG.PRICE[f.plan.value] * (m === 12 ? 10 : m);
});
$('panel').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  const { data, error } = await sb.rpc('admin_extend', { p_shop: f.dataset.form, p_plan: f.plan.value, p_months: +f.months.value, p_amount: +f.amount.value || 0, p_note: f.note.value });
  if (error) return alert(error.message);
  alert('Aktif sampai ' + fmt(data)); OPEN = null; load();
});
init();
