// Pendaftaran toko baru: akun (email + password) lalu data toko.
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const show = id => { ['vAkun', 'vCek', 'vToko', 'vSelesai'].forEach(v => { $(v).hidden = v !== id; }); const n = { vAkun: 1, vCek: 1, vToko: 2, vSelesai: 3 }[id]; ['st1', 'st2', 'st3'].forEach((s, i) => $(s).classList.toggle('on', i < n)); window.scrollTo(0, 0); };
const err = (id, t) => { $(id).textContent = t; $(id).hidden = !t; };
const toSlug = t => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
const slugOk = s => /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(s);
const linkFor = slug => window.shopLink({ slug });
const authMsg = m => /registered|already/i.test(m) ? 'Email ini sudah terdaftar. Masuk lewat halaman dashboard.' : /rate|limit|seconds/i.test(m) ? 'Terlalu sering mencoba. Tunggu sebentar lalu coba lagi.' : /password/i.test(m) ? 'Password minimal 8 karakter.' : m;
let EMAIL = '';
$('trialDays').textContent = CONFIG.TRIAL_DAYS;
$('slugPre').textContent = linkFor('').replace(/^https:\/\//, '');

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return show('vAkun');
  const { data } = await sb.rpc('my_shops');
  if (data?.length && new URLSearchParams(location.search).get('langkah') !== 'toko-baru') { location.href = '/owner/'; return; }
  show('vToko');
}

$('fAkun').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; err('eAkun', '');
  const email = f.email.value.trim(), password = f.password.value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return err('eAkun', 'Email belum benar.');
  if (password.length < 8) return err('eAkun', 'Password minimal 8 karakter.');
  if (!f.agree.checked) return err('eAkun', 'Centang persetujuan Syarat Layanan dan Kebijakan Privasi dulu.');
  $('bAkun').disabled = true; $('bAkun').textContent = 'Membuat akun…';
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/daftar/?langkah=toko' } });
  $('bAkun').disabled = false; $('bAkun').textContent = 'Buat akun';
  if (error) return err('eAkun', authMsg(error.message));
  EMAIL = email;
  if (data.session) return show('vToko');
  $('cekEmail').textContent = email; show('vCek');
});

$('fMasuk').addEventListener('submit', async e => {
  e.preventDefault(); err('eMasuk', '');
  const { error } = await sb.auth.signInWithPassword({ email: EMAIL, password: e.target.password.value });
  if (error) return err('eMasuk', /confirm/i.test(error.message) ? 'Email belum dikonfirmasi. Buka link di email dulu.' : 'Password salah.');
  boot();
});

// Alamat link dibuat otomatis dari nama, lalu dicek apakah masih tersedia.
let slugTouched = false, slugTimer = null, slugFree = false;
const f = $('fToko');
f.name.addEventListener('input', () => { if (!slugTouched) { f.slug.value = toSlug(f.name.value); checkSlug(); } });
f.slug.addEventListener('input', () => { slugTouched = true; const v = toSlug(f.slug.value); if (v !== f.slug.value) f.slug.value = v; checkSlug(); });
function checkSlug() {
  clearTimeout(slugTimer); slugFree = false; const s = f.slug.value, h = $('slugHint');
  if (!s) { h.textContent = ''; return; }
  if (!slugOk(s)) { h.className = 'hint bad'; h.textContent = 'Minimal 3 huruf/angka, boleh pakai tanda minus.'; return; }
  h.className = 'hint'; h.textContent = 'Mengecek…';
  slugTimer = setTimeout(async () => {
    const { data } = await sb.rpc('slug_available', { p_slug: s });
    if (f.slug.value !== s) return;
    slugFree = !!data; h.className = 'hint ' + (data ? 'ok' : 'bad');
    h.textContent = data ? `Tersedia: ${linkFor(s).replace(/^https:\/\//, '')}` : 'Sudah dipakai atau tidak boleh. Coba yang lain.';
  }, 350);
}

f.addEventListener('submit', async e => {
  e.preventDefault(); err('eToko', '');
  const name = f.name.value.trim(), slug = f.slug.value, wa = f.wa.value.replace(/\D/g, '').replace(/^62/, '0');
  if (name.length < 2) return err('eToko', 'Isi nama toko.');
  if (!slugOk(slug) || !slugFree) return err('eToko', 'Pilih alamat link yang tersedia.');
  if (!/^08\d{7,12}$/.test(wa)) return err('eToko', 'Nomor WA belum benar (contoh 0812xxxxxxx).');
  $('bToko').disabled = true; $('bToko').textContent = 'Membuat toko…';
  const { data, error } = await sb.rpc('create_shop', { p_name: name, p_slug: slug, p_wa: wa });
  $('bToko').disabled = false; $('bToko').textContent = 'Buat toko';
  if (error) return err('eToko', error.message);
  try { localStorage.setItem('owner_shop', data); } catch {}
  $('doneLink').textContent = linkFor(slug); $('toDash').href = `/owner/?toko=${data}&baru=1`; show('vSelesai');
});

sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_IN' && session && !$('vAkun').hidden) boot(); });
boot();
