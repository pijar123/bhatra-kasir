const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const show = id => ['stepAkun', 'stepCek', 'stepToko', 'stepPass'].forEach(s => { $(s).hidden = s !== id; });
const err = (id, t) => { $(id).textContent = t; $(id).hidden = !t; };
const toSlug = t => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const idMsg = m => /registered|already/i.test(m) ? 'Email ini sudah terdaftar. Silakan masuk, atau pakai Lupa password.'
  : /password/i.test(m) ? 'Password minimal 8 karakter.' : /email/i.test(m) ? 'Email belum benar.' : m;

$('brandHome').textContent = '← ' + CONFIG.BRAND;
$('hargaDasar').textContent = rp(CONFIG.PRICE.dasar);
$('slugSuffix').textContent = '.' + CONFIG.ROOT;

async function boot() {
  const step = new URLSearchParams(location.search).get('langkah');
  const { data: { session } } = await sb.auth.getSession();
  if (step === 'password' || location.hash.includes('type=recovery')) return show('stepPass');
  if (!session) return show('stepAkun');
  const { data } = await sb.from('shop_members').select('shop_id').limit(1);
  if (data?.length && step !== 'toko-baru') { location.href = '/owner/'; return; }
  show('stepToko');
}
sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') show('stepPass'); });

$('akunForm').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, btn = f.querySelector('button');
  if (!f.agree.checked) return err('akunErr', 'Centang persetujuan Syarat Layanan dan Kebijakan Privasi dulu.');
  if (f.password.value.length < 8) return err('akunErr', 'Password minimal 8 karakter.');
  btn.disabled = true; err('akunErr', '');
  const { data, error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.password.value,
    options: { emailRedirectTo: location.origin + '/daftar.html?langkah=toko' } });
  btn.disabled = false;
  if (error) return err('akunErr', idMsg(error.message));
  if (data.session) return show('stepToko');
  $('cekEmail').textContent = f.email.value.trim(); show('stepCek');
});

// link toko otomatis dari nama, cek apakah masih tersedia
let slugTouched = false, slugT = null;
const tf = $('tokoForm');
tf.name.addEventListener('input', () => { if (!slugTouched) { tf.slug.value = toSlug(tf.name.value); checkSlug(); } });
tf.slug.addEventListener('input', () => { slugTouched = true; tf.slug.value = toSlug(tf.slug.value); checkSlug(); });
function checkSlug() {
  clearTimeout(slugT); const v = tf.slug.value, m = $('slugMsg');
  if (v.length < 3) { m.textContent = 'Minimal 3 huruf.'; m.className = 'muted'; return; }
  m.textContent = 'Mengecek…'; m.className = 'muted';
  slugT = setTimeout(async () => {
    const { data } = await sb.rpc('slug_available', { p_slug: v });
    if (tf.slug.value !== v) return;
    m.textContent = data ? `Tersedia: ${v}.${CONFIG.ROOT}` : 'Sudah dipakai. Coba tambah nama daerah, misal ' + v + '-kebumen';
    m.className = data ? 'ok-msg' : 'err';
  }, 400);
}
tf.addEventListener('submit', async e => {
  e.preventDefault(); const btn = tf.querySelector('button');
  if (tf.name.value.trim().length < 2) return err('tokoErr', 'Nama toko belum diisi.');
  if (tf.slug.value.length < 3) return err('tokoErr', 'Link toko minimal 3 huruf.');
  btn.disabled = true; btn.textContent = 'Membuat toko…'; err('tokoErr', '');
  const { data, error } = await sb.rpc('create_shop', { p_slug: tf.slug.value, p_name: tf.name.value, p_wa: tf.wa.value });
  btn.disabled = false; btn.textContent = 'Buat toko';
  if (error) return err('tokoErr', error.message);
  try { localStorage.removeItem('owner_shop'); } catch {}
  location.href = '/owner/?baru=' + encodeURIComponent(data);
});

$('passForm').addEventListener('submit', async e => {
  e.preventDefault(); const pw = e.target.password.value;
  if (pw.length < 8) return err('passErr', 'Password minimal 8 karakter.');
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return err('passErr', error.message);
  location.href = '/owner/';
});
boot();
