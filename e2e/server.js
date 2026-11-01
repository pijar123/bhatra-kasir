// Server uji lokal: situs web/ + tiruan Supabase (auth, rest -> PostgREST :3001, functions).
// node e2e/server.js  -> http://localhost:8080
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const WEB = path.join(__dirname, '..', 'web'), CDN = process.env.CDN || '/home/claude/e2e/cdn';
const SECRET = 'rahasia-e2e-yang-panjang-sekali-minimal-32', PORT = +process.env.PORT || 8080;
const sql = q => execFileSync('psql', ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'e2e', '-tAc', q], { encoding: 'utf8' }).trim();
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = c => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(c); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const verify = t => { try { const [h, p, s] = t.split('.'); if (crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null; return JSON.parse(Buffer.from(p, 'base64url')); } catch { return null; } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.webp': 'image/webp' };
const CDNMAP = { 'supabase-js': 'supabase.js', 'jsQR.js': 'jsQR.js', 'leaflet.min.js': 'leaflet.min.js', 'leaflet.min.css': 'leaflet.min.css', 'qrcode.min.js': 'qrcode.min.js' };

function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  return { access_token: jwt({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: u.id, user };
}
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });

async function auth(req, res, u) {
  const body = req.method === 'POST' ? JSON.parse((await readBody(req)).toString() || '{}') : {};
  const ep = u.pathname.replace('/auth/v1/', '');
  const userBy = w => { const r = sql(`select id||'|'||email||'|'||coalesce(pw,'') from auth.users where ${w}`); if (!r) return null; const [id, email, pw] = r.split('|'); return { id, email, pw }; };
  if (ep === 'signup') {
    if (userBy(`email=${lit(body.email)}`)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
    const id = sql(`insert into auth.users(email,pw) values (${lit(body.email)},${lit(body.password)}) returning id`).split('\n')[0];
    return send(res, 200, session({ id, email: body.email }));
  }
  if (ep === 'token') {
    const g = u.searchParams.get('grant_type');
    const usr = g === 'refresh_token' ? userBy(`id=${lit(body.refresh_token)}::uuid`) : userBy(`email=${lit(body.email)}`);
    if (!usr || (g === 'password' && usr.pw !== body.password)) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return send(res, 200, session(usr));
  }
  if (ep === 'user') { const c = verify((req.headers.authorization || '').replace(/^Bearer /, '')); return c ? send(res, 200, session({ id: c.sub, email: c.email }).user) : send(res, 401, { msg: 'bad jwt' }); }
  if (ep === 'logout') return send(res, 204, '');
  if (ep === 'recover') return send(res, 200, {});
  return send(res, 404, { msg: 'auth stub: ' + ep });
}

async function rest(req, res, u) {
  const body = await readBody(req), h = { ...req.headers };
  delete h.host; delete h['content-length'];
  if (h.authorization && !verify(h.authorization.replace(/^Bearer /, ''))) delete h.authorization; // kunci anon -> peran anon
  const r = await fetch('http://localhost:3001' + u.pathname.replace('/rest/v1', '') + u.search, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  const out = Buffer.from(await r.arrayBuffer()), hd = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Expose-Headers': '*' };
  for (const k of ['content-type', 'content-range', 'preference-applied']) if (r.headers.get(k)) hd[k] = r.headers.get(k);
  res.writeHead(r.status, hd); res.end(out);
}

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (u.pathname.startsWith('/auth/v1/')) return auth(req, res, u);
    if (u.pathname.startsWith('/rest/v1/')) return rest(req, res, u);
    if (u.pathname.startsWith('/functions/v1/')) return send(res, 200, { publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' });
    if (u.pathname.startsWith('/storage/v1/')) return send(res, 200, { Key: 'banner/x' });
    if (u.pathname.startsWith('/__cdn/')) { const f = CDNMAP[u.pathname.split('/').pop()]; return f ? send(res, 200, fs.readFileSync(path.join(CDN, f)), MIME[path.extname(f)]) : send(res, 404, ''); }
    let p = path.join(WEB, decodeURIComponent(u.pathname));
    if (!p.startsWith(WEB)) return send(res, 403, '');
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) p = path.join(WEB, 'index.html'); // seperti .htaccess /slug
    let data = fs.readFileSync(p);
    if (p.endsWith('config.js')) data = data.toString().replace(/SUPABASE_URL:\s*'[^']*'/, `SUPABASE_URL: 'http://localhost:${PORT}'`);
    send(res, 200, data, MIME[path.extname(p)] || 'application/octet-stream');
  } catch (e) { console.error(e); send(res, 500, String(e)); }
}).listen(PORT, () => console.log('e2e di http://localhost:' + PORT));
