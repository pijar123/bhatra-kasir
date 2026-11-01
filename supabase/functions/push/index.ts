// Edge function "push" v2 (banyak warung).
// GET  -> { publicKey } untuk langganan notifikasi di dashboard.
// POST -> dipanggil trigger orders_push / push_test lewat pg_net, header x-hook wajib cocok.
//         Body memuat shop_id; hanya HP pemilik warung itu yang dikirimi.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
const rp = (n: number) => 'Rp' + Number(n || 0).toLocaleString('id-ID');

async function cfg() {
  let { data } = await db.from('push_cfg').select('*').eq('id', 1).maybeSingle();
  if (!data?.vapid_public) {
    const k = webpush.generateVAPIDKeys();
    await db.from('push_cfg').upsert({ id: 1, vapid_public: k.publicKey, vapid_private: k.privateKey });
    data = { ...(data || {}), vapid_public: k.publicKey, vapid_private: k.privateKey };
  }
  return data!;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const c = await cfg();
  if (req.method === 'GET') return Response.json({ publicKey: c.vapid_public }, { headers: cors });
  if (req.headers.get('x-hook') !== c.hook_secret) return new Response('forbidden', { status: 403 });

  const o = await req.json();
  if (!o.shop_id) return new Response('shop_id wajib', { status: 400 });
  const { data: shop } = await db.from('shops').select('name').eq('id', o.shop_id).maybeSingle();
  const app = shop?.name || 'Toko';

  const msg = o.test
    ? { title: `${app}: tes notifikasi`, body: 'Notifikasi pesanan sudah aktif di HP ini.', tag: 'tes' }
    : {
        title: `Pesanan baru #${o.code} · ${rp(o.total)}`,
        body: [o.items, `${o.name} · ${o.method === 'antar' ? 'Antar' : 'Ambil'} · ${o.payment === 'qris' ? 'QRIS' : 'Tunai'}`, o.note ? `Catatan: ${o.note}` : '']
          .filter(Boolean).join('\n'),
        tag: 'order-' + o.code,
      };

  webpush.setVapidDetails('mailto:admin@bhatra.id', c.vapid_public, c.vapid_private);
  const { data: subs } = await db.from('push_subs').select('endpoint, sub').eq('shop_id', o.shop_id);
  let sent = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify({ ...msg, url: '/owner/?toko=' + o.shop_id }), { TTL: 3600, urgency: 'high' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subs').delete().eq('endpoint', s.endpoint);
    }
  }));
  return Response.json({ sent }, { headers: cors });
});
