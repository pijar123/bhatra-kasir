// Uji ujung-ke-ujung v2. Jalankan: bash e2e/setup.sh && node e2e/server.js & node e2e/uji.js
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const { siapkan } = require('./lihat.js');
const B = 'http://localhost:8080', SHOT = process.env.SHOT || '/tmp';
const sql = q => execFileSync('psql', ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'e2e', '-tAc', q], { encoding: 'utf8' }).trim();
let ok = 0, gagal = 0;
const cek = (nama, kondisi, info = '') => { if (kondisi) { ok++; console.log('  lulus', nama); } else { gagal++; console.log('  GAGAL', nama, info); } };

async function halaman(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await siapkan(ctx);
  const pg = await ctx.newPage(); pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('dialog', d => d.accept());
  return pg;
}

(async () => {
  const b = await chromium.launch();

  console.log('1. Pembeli memesan di BHATRA');
  let pg = await halaman(b);
  await pg.goto(B + '/?toko=bhatra');
  await pg.waitForSelector('[data-add]');
  cek('judul toko BHATRA', /BHATRA/i.test(await pg.title()), await pg.title());
  await pg.locator('[data-add]').first().click();
  await pg.click('#openCheckout');
  await pg.fill('[name=name]', 'Uji Pembeli'); await pg.fill('[name=phone]', '081234567890');
  await pg.check('[name=method][value=pickup]', { force: true });
  await pg.click('#coSubmit');
  await pg.waitForSelector('#trackView:not([hidden])', { timeout: 8000 }).catch(() => {});
  await pg.screenshot({ path: SHOT + '/1-lacak.png' });
  const o = sql("select o.code||'|'||s.slug from orders o join shops s on s.id=o.shop_id where o.name='Uji Pembeli'");
  cek('pesanan tersimpan untuk toko bhatra', o.endsWith('|bhatra'), o + ' ' + (await pg.textContent('#coErr').catch(() => '')));
  cek('halaman lacak tampil', await pg.isVisible('#trackView'));
  cek('tanpa error JS (pembeli)', !pg.errs.length, pg.errs.join(' | '));
  const kode = o.split('|')[0];
  await pg.context().close();

  console.log('2. Pemilik BHATRA melihat pesanan');
  pg = await halaman(b);
  await pg.goto(B + '/owner/');
  await pg.fill('input[type=email]', 'istri@contoh.id'); await pg.fill('input[type=password]', 'rahasia123');
  await pg.click('#loginForm button[type=submit], form button[type=submit]');
  await pg.waitForTimeout(2500);
  const isi = await pg.textContent('body');
  cek('dashboard menampilkan pesanan baru', isi.includes(kode), kode);
  cek('nama toko di header', /BHATRA/i.test(isi));
  await pg.screenshot({ path: SHOT + '/2-owner.png' });
  cek('tanpa error JS (owner)', !pg.errs.length, pg.errs.join(' | '));
  await pg.context().close();

  console.log('3. Warung baru mendaftar');
  pg = await halaman(b);
  await pg.goto(B + '/daftar/');
  await pg.fill('#fAkun [name=email]', 'busri@contoh.id'); await pg.fill('#fAkun [name=password]', 'rahasia123');
  await pg.check('#fAkun [name=agree]'); await pg.click('#bAkun');
  await pg.waitForSelector('#vToko:not([hidden])', { timeout: 8000 });
  await pg.fill('#fToko [name=name]', 'Warung Bu Sri');
  await pg.waitForFunction(() => /Tersedia/.test(document.getElementById('slugHint').textContent), null, { timeout: 5000 }).catch(() => {});
  cek('slug otomatis dari nama', (await pg.inputValue('#slug')) === 'warung-bu-sri', await pg.inputValue('#slug'));
  cek('slug bhatra tidak tersedia', await pg.evaluate(async () => { const { data } = await sb.rpc('slug_available', { p_slug: 'bhatra' }); return data === false; }));
  await pg.fill('#fToko [name=wa]', '0812 3456 7890'); await pg.click('#bToko');
  await pg.waitForSelector('#vSelesai:not([hidden])', { timeout: 8000 });
  cek('link toko baru tampil', (await pg.textContent('#doneLink')).includes('warung-bu-sri'));
  await pg.screenshot({ path: SHOT + '/3-daftar.png' });
  await pg.click('#toDash'); await pg.waitForTimeout(2500);
  const dash = await pg.textContent('body');
  cek('dashboard toko baru terbuka', /Warung Bu Sri/.test(dash));
  cek('panduan siapkan toko tampil', /Siapkan toko/i.test(dash));
  cek('pesanan BHATRA tidak terlihat', !dash.includes(kode));
  await pg.screenshot({ path: SHOT + '/3-dash-baru.png', fullPage: true });
  const sid = sql("select id from shops where slug='warung-bu-sri'");
  const bocor = await pg.evaluate(async () => { const r = await sb.from('orders').select('code'); return r.data ? r.data.length : -1; });
  cek('pemilik baru tidak bisa membaca pesanan toko lain', bocor === 0, bocor);
  const ubah = await pg.evaluate(async id => (await sb.from('shops').update({ plan: 'pro', paid_until: '2099-01-01' }).eq('id', id)).error?.message || 'lolos', sid);
  cek('pemilik tidak bisa menaikkan paket sendiri', sql(`select plan from shops where id='${sid}'`) === 'trial', ubah);
  cek('masa coba 14 hari', sql(`select (trial_until::date - now()::date) from shops where id='${sid}'`) === '14');
  cek('tanpa error JS (daftar)', !pg.errs.length, pg.errs.join(' | '));
  await pg.context().close();

  console.log('4. Toko baru di sisi pembeli');
  sql(`insert into menu_items(shop_id, category, name, price, available) values ('${sid}', 'Makanan', 'Nasi Rames', 10000, true)`);
  sql(`update shops set open_time='00:00', close_time='23:59', delivery_until='23:59' where id='${sid}'`);
  pg = await halaman(b);
  await pg.goto(B + '/?toko=warung-bu-sri'); await pg.waitForSelector('[data-add]');
  const menu = await pg.textContent('#menu');
  cek('menu toko baru tampil', menu.includes('Nasi Rames'));
  cek('menu BHATRA tidak ikut', !/Bawang Putih/.test(menu));
  cek('QRIS disembunyikan (belum unggah)', !(await pg.isVisible('#qrisOpt')));
  await pg.screenshot({ path: SHOT + '/4-toko-baru.png' });
  await pg.goto(B + '/?toko=tidak-ada'); await pg.waitForTimeout(1500);
  cek('toko tak dikenal tidak error', !pg.errs.length, pg.errs.join(' | '));
  await pg.context().close();

  console.log('5. Admin pusat');
  pg = await halaman(b);
  await pg.goto(B + '/pusat/');
  await pg.fill('#loginForm [name=email]', 'admin@contoh.id'); await pg.fill('#loginForm [name=password]', 'rahasia123');
  await pg.click('#loginForm button'); await pg.waitForSelector('#appView:not([hidden])', { timeout: 8000 });
  const pus = await pg.textContent('#list');
  cek('daftar memuat kedua toko', pus.includes('Warung Bu Sri') && /BHATRA/i.test(pus));
  await pg.locator('article', { hasText: 'Warung Bu Sri' }).locator('[data-ext*="|dasar|"]').click();
  await pg.waitForTimeout(1500);
  cek('perpanjang Dasar tersimpan', sql(`select plan from shops where id='${sid}'`) === 'dasar');
  await pg.screenshot({ path: SHOT + '/5-pusat.png', fullPage: true });
  cek('tanpa error JS (pusat)', !pg.errs.length, pg.errs.join(' | '));
  await pg.context().close();

  pg = await halaman(b);
  await pg.goto(B + '/pusat/');
  await pg.fill('#loginForm [name=email]', 'istri@contoh.id'); await pg.fill('#loginForm [name=password]', 'rahasia123');
  await pg.click('#loginForm button'); await pg.waitForTimeout(1500);
  cek('pemilik biasa ditolak di pusat', await pg.isHidden('#appView'));
  await pg.context().close();

  console.log('6. Halaman produk dan legal');
  pg = await halaman(b);
  for (const p of ['/produk/', '/legal/syarat.html', '/legal/privasi.html', '/']) {
    await pg.goto(B + p); await pg.waitForTimeout(800);
    const lebar = await pg.evaluate(() => document.documentElement.scrollWidth);
    cek(`${p} tanpa geser samping di HP`, lebar <= 390, lebar);
  }
  cek('tanpa slug diarahkan ke /produk/', pg.url().includes('/produk/'), pg.url());
  await pg.goto(B + '/produk/'); await pg.screenshot({ path: SHOT + '/6-produk.png', fullPage: true });
  cek('tanpa error JS (produk)', !pg.errs.length, pg.errs.join(' | '));
  await b.close();

  console.log(gagal ? `\n${gagal} GAGAL, ${ok} lulus` : `\nSEMUA ${ok} UJI LULUS`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
