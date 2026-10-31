\set ON_ERROR_STOP 1
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@x.id'), ('22222222-2222-2222-2222-222222222222', 'b@x.id'), ('99999999-9999-9999-9999-999999999999', 'admin@x.id');
insert into platform_admins values ('99999999-9999-9999-9999-999999999999');

-- 1. owner A daftar toko
set role authenticated; select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select create_shop('bhatra', 'Warung Jajan BHATRA', '0813 9112 5240') as toko_a;
update shops set open_time = '00:00', close_time = '00:00', delivery_from = '00:00', delivery_until = '00:00',
  shop_lat = -7.70, shop_lng = 109.40, qris_static = '00020101021126570011ID.DANA.WWW0118936009153035512782020903551278203',
  plan = 'dasar', paid_until = now() + interval '5 years' where slug = 'bhatra';   -- plan/paid_until harus ditolak guard
select 'guard', plan, paid_until is null as paid_tetap_null from shops where slug = 'bhatra';
insert into menu_items (shop_id, category, name, price, variants, stock) select id, 'Makanan', 'Ayam Bawang Putih', 16000, '{Original,Geprek}', 5 from shops where slug = 'bhatra';
insert into menu_items (shop_id, category, name, price) select id, 'Minuman', 'Es Teh', 4000 from shops where slug = 'bhatra';
insert into vouchers (shop_id, code, kind, value, min_order) select id, 'HEMAT5', 'rp', 5000, 20000 from shops where slug = 'bhatra';

-- 2. owner B daftar toko lain, tidak boleh lihat data A
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select create_shop('sateb', 'Sate Bu B', '081234567890') as toko_b;
select 'isolasi B melihat menu A', count(*) from menu_items m join shops s on s.id = m.shop_id where s.slug = 'bhatra';
with x as (update shops set name = 'DIRETAS' where slug = 'bhatra' returning 1) select 'isolasi B update A', count(*) from x;
select 'slug dobel ditolak'; \set ON_ERROR_STOP 0
select create_shop('bhatra', 'X', '081234567890');
\set ON_ERROR_STOP 1

-- 3. pembeli (anon) memesan
reset role; select (select id from menu_items where name = 'Ayam Bawang Putih') as ayam, (select id from menu_items where name = 'Es Teh') as teh \gset
 set role anon; select set_config('test.uid', '', false);
select 'publik', x->>'name', x->>'active', x->>'pro', jsonb_array_length(x->'menu') as jml_menu, x ? 'kasir_secret' as bocor_secret from shop_public('bhatra') x;
select 'voucher kurang', check_voucher('bhatra', 'hemat5', 16000)->>'msg';
select 'voucher ok', check_voucher('bhatra', 'hemat5', 36000)->>'disc';
select * from place_order('bhatra', jsonb_build_object('name', 'Budi', 'phone', '0812 3456 7890', 'method', 'delivery', 'payment', 'qris',
  'address', 'Rumah hijau', 'lat', -7.71, 'lng', 109.41, 'voucher', 'HEMAT5',
  'items', jsonb_build_array(jsonb_build_object('id', :ayam, 'qty', 2, 'variant', 'Geprek'),
                             jsonb_build_object('id', :teh, 'qty', 1)))) \gset
select 'order', o->>'code', (o->>'subtotal')::int as subtotal, (o->>'discount')::int as disc, (o->>'ongkir')::int as ongkir, (o->>'unique_code')::int as uc,
  o->'shop'->>'name' as toko from get_order(:'order_token') o;
select 'stok sisa', stock from menu_items where name = 'Ayam Bawang Putih';
reset role;
select (subtotal + ongkir + unique_code) as total, code from orders where token = :'order_token' \gset
select kasir_secret from shops where slug = 'bhatra' \gset

-- 4. HP kasir: notifikasi DANA cocok -> lunas; secret toko lain tidak bisa
set role anon;
select 'tes', dana_paid(:'kasir_secret', 'TES koneksi Rp1');
select 'bayar', dana_paid(:'kasir_secret', 'Pembayaran Masuk Rp' || to_char(:total, 'FM999G999') || ' diterima DANA Bisnis.');
select 'secret salah', dana_paid('000000000000000000000000', 'Rp1.000');
select 'kasir_orders', count(*) from kasir_orders(:'kasir_secret', now() - interval '5 minutes');
reset role;
select 'lunas?', paid from orders where token = :'order_token';
select 'push dipanggil', count(*) from net.calls;

-- 5. batal -> stok kembali
update orders set status = 'batal' where token = :'order_token';
select 'stok setelah batal', stock from menu_items where name = 'Ayam Bawang Putih';

-- 6. admin platform: lihat semua toko, perpanjang langganan
set role authenticated; select set_config('test.uid', '99999999-9999-9999-9999-999999999999', false);
select 'admin', slug, plan, active, orders_30d, owner_email from admin_shops();
select 'perpanjang', admin_extend((select id from shops where slug = 'sateb'), 'dasar', 3, 147000, 'transfer BCA') > now() + interval '80 days';
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select 'bukan admin'; \set ON_ERROR_STOP 0
select admin_shops();
\set ON_ERROR_STOP 1

-- 7. masa coba habis -> toko tutup untuk pesanan, fitur pro hilang
reset role; select set_config('test.uid', '', false);
update shops set trial_until = now() - interval '10 days', paid_until = null where slug = 'bhatra';
set role anon;
select 'publik setelah habis', x->>'active', x->>'pro' from shop_public('bhatra') x;
\set ON_ERROR_STOP 0
select * from place_order('bhatra', '{"name":"C","phone":"081211112222","method":"pickup","payment":"tunai","items":[{"id":2,"qty":1}]}');
