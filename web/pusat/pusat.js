// Admin pusat: semua toko, status langganan, perpanjang, bekukan.
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const tgl = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const ago = d => { if (!d) return 'belum pernah'; const m = Math.round((Date.now() - new Date(d)) / 6e4); return m < 60 ? m + ' mnt lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu'; };
let ROWS = [], F = 'semua';

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $('loginView').hidden = false; return; }
  const { data, error } = await sb.rpc('admin_shops');
  if (error) { $('loginView').hidden = false; $('loginErr').textContent = 'Akun ini bukan admin pusat.'; $('loginErr').hidden = false; return; }
  ROWS = data || []; $('loginView').hidden = true; $('appView').hidden = false; render();
}
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value, password: f.password.value });
  if (error) { $('loginErr').textContent = 'Email atau password salah'; $('loginErr').hidden = false; return; }
  init();
});
$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

function render() {
  const free = r => r.paid_until && new Date(r.paid_until).getFullYear() >= 2090;
  const paid = ROWS.filter(r => r.plan !== 'trial' && r.active && !free(r)), trial = ROWS.filter(r => r.plan === 'trial' && r.active);
  const mrr = paid.reduce((a, r) => a + (CONFIG.PRICES[r.plan] || 0), 0);
  $('sum').innerHTML = `<div><p>Toko</p><b>${ROWS.length}</b></div><div><p>Masa coba aktif</p><b>${trial.length}</b></div><div><p>Berbayar aktif</p><b>${paid.length}</b></div><div><p>Pendapatan / bulan${ROWS.some(free) ? ' (tanpa toko gratis)' : ''}</p><b>${rp(mrr)}</b></div>`;
  const L = ROWS.filter(r => F === 'semua' || (F === 'coba' && r.plan === 'trial' && r.active) || (F === 'bayar' && r.plan !== 'trial' && r.active) || (F === 'mati' && !r.active));
  $('list').innerHTML = L.length ? L.map(card).join('') : '<p class="empty">Tidak ada toko di sini.</p>';
}
function card(r) {
  const until = r.plan === 'trial' ? r.trial_until : r.paid_until, wa = r.wa ? String(r.wa) : '';
  const status = r.suspended ? 'Dibekukan' : !r.active ? 'Tidak aktif' : r.plan === 'trial' ? 'Masa coba' : r.plan === 'pro' ? 'Pro' : 'Dasar';
  return `<article class="card shop"><h3>${esc(r.name)} <small>${esc(r.slug)}</small></h3>
    <div class="badges"><span class="b ${r.active ? 'ok' : 'red'}">${status}</span><span class="b">s.d. ${tgl(until)}</span></div>
    <div class="meta"><span>Pemilik: ${esc(r.owners || '—')}</span><span>${r.orders_30d} pesanan / 30 hari</span><span>Pesanan terakhir: ${ago(r.last_order)}</span><span>HP kasir: ${ago(r.kasir_ping)}</span><span>Daftar: ${tgl(r.created_at)}</span></div>
    <div class="acts">
      <button type="button" class="next" data-ext="${r.id}|pro|1">Pro +1 bulan</button>
      <button type="button" data-ext="${r.id}|dasar|1">Dasar +1 bulan</button>
      <button type="button" data-ext="${r.id}|${r.plan === 'trial' ? 'pro' : r.plan}|12">+1 tahun</button>
      <button type="button" class="danger" data-sus="${r.id}|${!r.suspended}">${r.suspended ? 'Aktifkan lagi' : 'Bekukan'}</button>
      ${wa ? `<a class="wa" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WA</a>` : ''}
      <a href="${esc(window.shopLink(r))}" target="_blank" rel="noopener">Buka toko</a>
    </div></article>`;
}
document.addEventListener('click', async e => {
  const fb = e.target.closest('[data-f]');
  if (fb) { F = fb.dataset.f; document.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', b === fb)); return render(); }
  const ex = e.target.closest('[data-ext]');
  if (ex) {
    const [id, plan, months] = ex.dataset.ext.split('|'), r = ROWS.find(x => x.id === id);
    const base = r.plan !== 'trial' && r.paid_until && new Date(r.paid_until) > Date.now() ? new Date(r.paid_until) : new Date();
    base.setMonth(base.getMonth() + +months);
    if (!confirm(`${r.name}: paket ${plan === 'pro' ? 'Pro' : 'Dasar'} aktif sampai ${tgl(base)}?`)) return;
    const { error } = await sb.rpc('admin_update_shop', { p_shop: id, p_plan: plan, p_paid_until: base.toISOString(), p_suspended: false });
    if (error) return alert(error.message); return init();
  }
  const su = e.target.closest('[data-sus]');
  if (su) {
    const [id, v] = su.dataset.sus.split('|'), r = ROWS.find(x => x.id === id);
    if (!confirm(v === 'true' ? `Bekukan ${r.name}? Pembeli tidak bisa pesan sampai diaktifkan lagi.` : `Aktifkan lagi ${r.name}?`)) return;
    const { error } = await sb.rpc('admin_update_shop', { p_shop: id, p_plan: null, p_paid_until: r.paid_until, p_suspended: v === 'true' });
    if (error) return alert(error.message); return init();
  }
});
init();
