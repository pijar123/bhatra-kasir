// Screenshot halaman toko BHATRA di tiap tema -> galeri.
const { chromium } = require('playwright'); const { execFileSync } = require('child_process'); const { siapkan } = require('./lihat.js');
const sql = q => execFileSync('psql', ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'e2e', '-tAc', q]);
(async () => {
  const b = await chromium.launch(), out = process.argv[2];
  for (const t of ['hangat', 'segar', 'kopi', 'manis', 'laut', 'pedas', 'malam', 'polos']) {
    sql(`update shops set theme='{"preset":"${t}"}' where slug='bhatra'`);
    const ctx = await b.newContext({ viewport: { width: 390, height: 700 } }); await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.continue()); await siapkan(ctx);
    await ctx.unroute(/fonts\.(googleapis|gstatic)\.com|tile\.openstreetmap|wa\.me/);
    const pg = await ctx.newPage(); await pg.goto('http://localhost:8080/?toko=bhatra'); await pg.waitForSelector('[data-add]'); await pg.waitForTimeout(1500);
    await pg.screenshot({ path: `${out}/tema-${t}.png` }); await ctx.close();
  }
  sql(`update shops set theme='{"preset":"hangat"}' where slug='bhatra'`); await b.close();
})();
