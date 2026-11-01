-- Uji otomatis migrasi 001. Setiap kegagalan menghentikan skrip dengan pesan "GAGAL: ...".
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  if u is null then perform set_config('role', 'anon', false); perform set_config('request.jwt.claim.sub', '', false);
  else perform set_config('role', 'authenticated', false); perform set_config('request.jwt.claim.sub', u, false); end if;
end $$;
create or replace function pg_temp.su() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', false); perform set_config('request.jwt.claim.sub', '', false); end $$;
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(c, false) then raise exception 'GAGAL: %', msg; end if; raise notice 'lulus: %', msg; end $$;

-- 1. Data BHATRA pindah utuh
select pg_temp.ok((select count(*) from menu_items where shop_id = '00000000-0000-4000-8000-0000000000b1') = 2, 'menu BHATRA tetap 2 item');
select pg_temp.ok((select count(*) from orders where shop_id = '00000000-0000-4000-8000-0000000000b1') = 1, 'pesanan lama BHATRA terbawa');
select pg_temp.ok((select secret from kasir_keys) = 'aaaaaaaaaaaaaaaaaaaaaaaa', 'kode rahasia Kasir BHATRA sama (aplikasi tidak perlu dihubungkan ulang)');
select pg_temp.ok((select count(*) from shop_members) = 1, 'akun lama jadi anggota BHATRA');
select pg_temp.ok((select shop_lat from shops where slug = 'bhatra') = -7.7, 'lokasi BHATRA terbawa');

-- 2. Pembeli (anon)
select pg_temp.as_user(null);
select pg_temp.ok((resolve_shop('bhatra.id', null))->>'slug' = 'bhatra', 'toko ditemukan dari domain bhatra.id');
select pg_temp.ok((resolve_shop('www.bhatra.id', null))->>'slug' = 'bhatra', 'toko ditemukan dari www.bhatra.id');
select pg_temp.ok((resolve_shop(null, 'BHATRA'))->>'active' = 'true', 'toko ditemukan dari slug, status aktif');
select pg_temp.ok(resolve_shop(null, 'tidak-ada') is null, 'slug tak dikenal = kosong');
select pg_temp.ok((select count(*) from orders) = 0, 'pembeli tidak bisa membaca daftar pesanan');
select pg_temp.ok((select count(*) from kasir_keys) = 0, 'pembeli tidak bisa membaca kode rahasia Kasir');
create temp table hasil as
  select * from place_order(jsonb_build_object('shop', '00000000-0000-4000-8000-0000000000b1', 'name', 'Budi', 'phone', '0812 3456 7890',
    'method', 'pickup', 'payment', 'qris', 'items', jsonb_build_array(jsonb_build_object('id', 1, 'variant', 'Geprek', 'qty', 2))));
select pg_temp.ok((select count(*) from hasil) = 1, 'pembeli bisa pesan QRIS di BHATRA');
select pg_temp.ok(slug_available('warung-uji'), 'slug baru tersedia');
select pg_temp.ok(not slug_available('bhatra') and not slug_available('admin') and not slug_available('A b'), 'slug terpakai/terlarang/tidak valid ditolak');
do $$ begin perform create_shop('X', 'x-y-z', '081200000000'); raise exception 'GAGAL: anon bisa membuat toko';
exception when insufficient_privilege then raise notice 'lulus: anon tidak bisa membuat toko'; end $$;

-- 3. Kasir: bayar QRIS cocok -> lunas
select pg_temp.su();
select pg_temp.as_user(null);
select pg_temp.ok(
  dana_paid('aaaaaaaaaaaaaaaaaaaaaaaa', 'Pembayaran Masuk Rp' || (select subtotal + ongkir + unique_code from get_order((select order_token from hasil))) || ' diterima DANA Bisnis.') like 'lunas #%',
  'notifikasi DANA melunasi pesanan yang cocok');
select pg_temp.ok((select paid from get_order((select order_token from hasil))), 'status pesanan jadi lunas');
select pg_temp.ok(dana_paid('salah', 'Rp1') = 'secret salah', 'kode rahasia salah ditolak');
select pg_temp.ok((select count(*) from kasir_orders('aaaaaaaaaaaaaaaaaaaaaaaa', now() - interval '5 minutes') k where k.code = (select order_code from hasil)) = 1, 'Kasir menerima pesanan baru untuk dibunyikan');

-- 4. Pemilik warung baru: terisolasi dari BHATRA
select pg_temp.su();
insert into auth.users (id, email) values ('22222222-2222-4222-8222-222222222222', 'baru@contoh.id');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
create temp table toko2 as select create_shop('Warung Uji', 'warung-uji', '0812-9999-8888') id;
select pg_temp.ok((select count(*) from my_shops()) = 1, 'pemilik baru melihat 1 toko miliknya');
select pg_temp.ok((select count(*) from orders) = 0, 'pemilik baru TIDAK melihat pesanan BHATRA');
select pg_temp.ok((select count(*) from pay_log) = 0, 'pemilik baru TIDAK melihat log bayar BHATRA');
select pg_temp.ok((select count(*) from kasir_keys) = 1, 'pemilik baru hanya melihat kode Kasir tokonya');
select pg_temp.ok((select count(*) from vouchers) = 0, 'pemilik baru TIDAK melihat kode promo BHATRA');
update shops set name = 'Dibajak' where slug = 'bhatra';
select pg_temp.su();
select pg_temp.ok((select name from shops where slug = 'bhatra') = 'Warung Jajan BHATRA', 'pemilik baru TIDAK bisa mengubah toko BHATRA');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
update shops set plan = 'pro', paid_until = '2099-01-01', name = 'Warung Uji Rasa' where slug = 'warung-uji';
select pg_temp.su();
select pg_temp.ok((select plan = 'trial' and paid_until is null and name = 'Warung Uji Rasa' from shops where slug = 'warung-uji'),
  'pemilik bisa ganti nama, TIDAK bisa ubah paket/langganan sendiri');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
do $$ begin insert into menu_items (shop_id, category, name, price) values ('00000000-0000-4000-8000-0000000000b1', 'X', 'Susupan', 1);
  raise exception 'GAGAL: bisa menambah menu ke toko lain';
exception when insufficient_privilege then raise notice 'lulus: tidak bisa menambah menu ke toko lain'; end $$;
insert into menu_items (shop_id, category, name, price) select id, 'Makanan', 'Mie Ayam', 12000 from toko2;
select pg_temp.ok((select count(*) from menu_items where shop_id = (select id from toko2)) = 1, 'pemilik bisa menambah menu di tokonya');
do $$ begin perform admin_shops(); raise exception 'GAGAL: pemilik biasa bisa membuka admin pusat';
exception when raise_exception then
  if sqlerrm like 'GAGAL%' then raise; end if; raise notice 'lulus: pemilik biasa tidak bisa membuka admin pusat'; end $$;

-- 5. Pembeli di toko baru
select pg_temp.as_user(null);
do $$ begin
  perform place_order(jsonb_build_object('shop', (select (resolve_shop(null, 'warung-uji'))->>'id'), 'name', 'Ani', 'phone', '081211112222',
    'method', 'pickup', 'payment', 'qris', 'items', jsonb_build_array(jsonb_build_object('id', (select id from menu_items where name = 'Mie Ayam'), 'qty', 1))));
  raise exception 'GAGAL: QRIS diterima padahal toko belum unggah QRIS';
exception when raise_exception then
  if sqlerrm like 'GAGAL%' then raise; end if; raise notice 'lulus: QRIS ditolak sebelum toko unggah QRIS (%)', sqlerrm; end $$;
do $$ begin
  perform place_order(jsonb_build_object('shop', (select (resolve_shop(null, 'warung-uji'))->>'id'), 'name', 'Ani', 'phone', '081211112222',
    'method', 'pickup', 'payment', 'tunai', 'items', jsonb_build_array(jsonb_build_object('id', 1, 'qty', 1))));
  raise exception 'GAGAL: menu toko lain bisa dipesan';
exception when raise_exception then
  if sqlerrm like 'GAGAL%' then raise; end if; raise notice 'lulus: menu BHATRA tidak bisa dipesan lewat toko lain'; end $$;
select pg_temp.ok((select count(*) from place_order(jsonb_build_object('shop', (select (resolve_shop(null, 'warung-uji'))->>'id'), 'name', 'Ani',
    'phone', '081211112222', 'method', 'pickup', 'payment', 'tunai',
    'items', jsonb_build_array(jsonb_build_object('id', (select id from menu_items where name = 'Mie Ayam'), 'qty', 1))))) = 1, 'pembeli bisa pesan tunai di toko baru');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select pg_temp.ok((select count(*) from orders) = 1, 'pemilik baru melihat tepat 1 pesanan miliknya');

-- 6. Masa coba habis -> toko berhenti menerima pesanan
select pg_temp.su();
update shops set trial_until = now() - interval '1 day' where slug = 'warung-uji';
select pg_temp.as_user(null);
select pg_temp.ok((resolve_shop(null, 'warung-uji'))->>'active' = 'false', 'toko yang masa cobanya habis berstatus tidak aktif');
do $$ begin
  perform place_order(jsonb_build_object('shop', (select (resolve_shop(null, 'warung-uji'))->>'id'), 'name', 'Ani', 'phone', '081211113333',
    'method', 'pickup', 'payment', 'tunai', 'items', jsonb_build_array(jsonb_build_object('id', (select id from menu_items where name = 'Mie Ayam'), 'qty', 1))));
  raise exception 'GAGAL: toko tidak aktif masih menerima pesanan';
exception when raise_exception then
  if sqlerrm like 'GAGAL%' then raise; end if; raise notice 'lulus: toko tidak aktif menolak pesanan'; end $$;

-- 7. Admin pusat
select pg_temp.su();
insert into platform_admins values ('11111111-1111-4111-8111-111111111111');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select pg_temp.ok((select count(*) from admin_shops()) = 2, 'admin pusat melihat semua toko');
select admin_update_shop((select id from shops where slug = 'warung-uji'), 'dasar', now() + interval '30 days', false);
select pg_temp.su();
select pg_temp.ok((select plan = 'dasar' and paid_until > now() from shops where slug = 'warung-uji'), 'admin pusat bisa memperpanjang langganan');
select pg_temp.as_user(null);
select pg_temp.ok((resolve_shop(null, 'warung-uji'))->>'active' = 'true' and (resolve_shop(null, 'warung-uji'))->>'pro' = 'false',
  'paket Dasar aktif tetapi tanpa fitur Pro');
select pg_temp.ok((check_voucher((select id from shops where slug = 'bhatra'), 'hemat5', 20000))->>'ok' = 'true', 'kode promo BHATRA berlaku');
-- 8. Tampilan (002): paket Dasar hanya menyimpan preset; desain khusus hanya admin.
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
update shops set theme = '{"preset":"segar","primary":"#123456","font":"bulat"}', design = '{"css":"body{}"}' where slug = 'warung-uji';
select pg_temp.su();
select pg_temp.ok((select theme = '{"preset":"segar"}' and design = '{}' from shops where slug = 'warung-uji'),
  'pemilik Dasar: warna/huruf dibuang, desain khusus tidak bisa diubah');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
do $$ begin perform admin_update_design((select id from shops where slug = 'warung-uji'), '{"css":"x"}');
  raise exception 'GAGAL: pemilik bisa memanggil admin_update_design';
exception when raise_exception then if sqlerrm like 'GAGAL%' then raise; end if; raise notice 'lulus: desain khusus hanya admin'; end $$;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select admin_update_design((select id from shops where slug = 'warung-uji'), '{"css":".hero{border-radius:0}","hero_img":"https://contoh.id/a.webp"}', '{"preset":"kopi","font":"klasik"}');
select pg_temp.as_user(null);
select pg_temp.ok((resolve_shop(null, 'warung-uji'))->'design'->>'css' = '.hero{border-radius:0}' and (resolve_shop(null, 'warung-uji'))->'theme'->>'font' = 'klasik',
  'admin pusat menyimpan desain khusus, terbaca di halaman toko');
select pg_temp.su();
delete from platform_admins where user_id = '11111111-1111-4111-8111-111111111111';
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
update shops set theme = '{"preset":"manis","primary":"#D6457A"}', design = '{"css":"x"}' where slug = 'bhatra';
select pg_temp.su();
select pg_temp.ok((select theme->>'primary' = '#D6457A' and design = '{}' from shops where slug = 'bhatra'), 'pemilik Pro boleh warna sendiri, tetap tidak bisa ubah desain khusus');
-- 9. Pemantauan (003)
select pg_temp.as_user(null);
select log_client_error((select id from shops where slug = 'bhatra'), '/', 'TypeError: x is undefined', 'shop.js:10', 'uji');
select log_client_error(null, '/', repeat('a', 2000), null, null);
select pg_temp.su();
select pg_temp.ok((select count(*) = 2 and max(length(msg)) = 500 from client_errors), 'error browser tercatat dan dipotong');
select pg_temp.as_user(null);
do $$ begin perform count(*) from client_errors; raise exception 'GAGAL: anon bisa membaca client_errors';
exception when insufficient_privilege then raise notice 'lulus: anon tidak bisa membaca error'; end $$;
do $$ begin perform admin_errors(24); raise exception 'GAGAL: anon bisa memanggil admin_errors';
exception when insufficient_privilege then raise notice 'lulus: admin_errors khusus admin'; end $$;
select pg_temp.su();
update kasir_keys set last_ping = now() - interval '3 hours' where shop_id = (select id from shops where slug = 'bhatra');
update shops set open_time = '00:00', close_time = '23:59', is_open = true where slug = 'bhatra';
select pg_temp.as_user(null);
select pg_temp.ok((health())->'kasir_mati' ? 'Warung Jajan BHATRA' and (health()->>'error_1jam')::int = 2, 'cek kesehatan mendeteksi HP kasir mati');
select pg_temp.su();
select 'SEMUA UJI LULUS' as hasil;
