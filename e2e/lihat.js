// node lihat.js <path> [out.png] : buka halaman di HP tiruan, cetak error konsol, simpan screenshot.
const { chromium } = require('playwright');
module.exports.siapkan = async (ctx) => {
  await ctx.route(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/, r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8080/__cdn/' + r.request().url().split('/').pop().replace(/@2$/, '').replace(/^supabase-js$/, 'supabase-js') } }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|tile\.openstreetmap|wa\.me/, r => r.abort());
};
if (require.main === module) (async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await module.exports.siapkan(ctx);
  const pg = await ctx.newPage(); const errs = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.goto('http://localhost:8080' + process.argv[2]); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: process.argv[3] || '/tmp/shot.png', fullPage: false });
  console.log(pg.url(), '\n', errs.join('\n') || 'tanpa error');
  await b.close();
})();
