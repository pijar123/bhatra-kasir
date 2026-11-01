-- =====================================================================
-- 001 · Ubah database BHATRA (satu warung) menjadi banyak warung.
-- Jalankan SEKALI di Supabase SQL editor, BERSAMAAN dengan memasang web v2
-- (web v1 tidak cocok lagi setelah migrasi ini). Semua data BHATRA tetap ada,
-- menjadi warung pertama dengan slug 'bhatra' dan domain bhatra.id.
-- Aman dijalankan ulang (idempotent).
-- =====================================================================
begin;

-- ---------- 1. Warung, anggota, admin pusat ----------
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  name text not null check (length(name) between 2 and 60),
  tagline text check (length(tagline) <= 80),
  wa text,
  address text check (length(address) <= 160),
  custom_domain text unique,
  qris_payload text,
  qris_merchant text,
  is_open boolean not null default true,
  open_time time not null default '10:00',
  close_time time not null default '21:00',
  delivery_from time not null default '10:00',
  delivery_until time not null default '20:00',
  ongkir_per_km int not null default 1000 check (ongkir_per_km >= 0),
  max_km numeric not null default 10,
  shop_lat double precision,
  shop_lng double precision,
  categories text[] not null default array['Makanan', 'Minuman'],
  banners text[] not null default '{}',
  prep_min int not null default 20,
  free_ongkir_min int not null default 0,
  plan text not null default 'trial' check (plan in ('trial', 'dasar', 'pro')),
  trial_until timestamptz not null default now() + interval '14 days',
  paid_until timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
alter table shops add column if not exists logo_url text;
alter table shops add column if not exists about text check (length(about) <= 120);
create table if not exists shop_members (
  shop_id uuid not null references shops on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create table if not exists platform_admins (user_id uuid primary key references auth.users on delete cascade);
create table if not exists kasir_keys (
  shop_id uuid primary key references shops on delete cascade,
  secret text not null unique default encode(gen_random_bytes(12), 'hex'),
  last_ping timestamptz
);

-- BHATRA = warung pertama (id tetap, supaya bisa dirujuk)
insert into shops (id, slug, name, tagline, wa, address, custom_domain, qris_payload, qris_merchant, plan, paid_until,
                   is_open, open_time, close_time, delivery_from, delivery_until, ongkir_per_km, max_km, shop_lat, shop_lng,
                   categories, banners, prep_min, free_ongkir_min)
select '00000000-0000-4000-8000-0000000000b1', 'bhatra', 'Warung Jajan BHATRA', 'Dari dapur Bhre & Trah', '6281391125240',
       'Karangtempel, Demangsari, Kec. Ayah, Kebumen', 'bhatra.id',
       '00020101021126570011ID.DANA.WWW011893600915303551278202090355127820303UMI51440014ID.CO.QRIS.WWW0215ID10266044379170303UMI5204581253033605802ID5919WARUNG JAJAN BHATRA6012Kab. Kebumen6105544736304D7F3',
       'WARUNG JAJAN BHATRA', 'pro', '2099-12-31',
       s.is_open, s.open_time, s.close_time, coalesce(s.delivery_from, s.open_time), s.delivery_until, s.ongkir_per_km,
       coalesce(s.max_km, 10), s.shop_lat, s.shop_lng, s.categories, s.banners, s.prep_min, s.free_ongkir_min
from settings s where s.id = 1
on conflict (id) do nothing;
update shops set logo_url = coalesce(logo_url, '/img/logo.svg'), about = coalesce(about, 'Masakan rumahan, harga pelajar.')
 where id = '00000000-0000-4000-8000-0000000000b1';

insert into shop_members (shop_id, user_id)
select '00000000-0000-4000-8000-0000000000b1', id from auth.users
on conflict do nothing;

insert into kasir_keys (shop_id, secret, last_ping)
select '00000000-0000-4000-8000-0000000000b1', secret, last_ping from pay_config limit 1
on conflict do nothing;

-- ---------- 2. Kolom shop_id di semua tabel data ----------
do $$
declare t text;
begin
  foreach t in array array['menu_items', 'orders', 'vouchers', 'blocked_phones', 'push_subs', 'pay_log'] loop
    execute format('alter table %I add column if not exists shop_id uuid references shops on delete cascade', t);
    execute format('update %I set shop_id = %L where shop_id is null', t, '00000000-0000-4000-8000-0000000000b1');
    execute format('alter table %I alter column shop_id set not null', t);
    execute format('create index if not exists %I on %I (shop_id)', t || '_shop_idx', t);
  end loop;
end $$;

-- Kunci unik sekarang per warung (kode promo & nomor diblokir boleh sama di warung lain)
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'vouchers'::regclass and contype = 'p';
  if c is not null and c <> 'vouchers_shop_pkey' then
    execute format('alter table vouchers drop constraint %I', c);
    alter table vouchers add constraint vouchers_shop_pkey primary key (shop_id, code);
  end if;
  select conname into c from pg_constraint where conrelid = 'blocked_phones'::regclass and contype = 'p';
  if c is not null and c <> 'blocked_shop_pkey' then
    execute format('alter table blocked_phones drop constraint %I', c);
    alter table blocked_phones add constraint blocked_shop_pkey primary key (shop_id, phone);
  end if;
end $$;
create index if not exists orders_shop_created_idx on orders (shop_id, created_at desc);

-- ---------- 3. Fungsi bantu ----------
create or replace function in_window(t time, s time, e time) returns boolean language sql immutable as $$
  select case when s = e then true when s < e then t >= s and t <= e else t >= s or t <= e end $$;
create or replace function km_between(a double precision, b double precision, c double precision, d double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(power(sin(radians(c - a) / 2), 2) + cos(radians(a)) * cos(radians(c)) * power(sin(radians(d - b) / 2), 2))) $$;
create or replace function norm_phone(t text) returns text language sql immutable as
  $$ select regexp_replace(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '^62', '0') $$;
create or replace function rp_txt(n int) returns text language sql immutable as
  $$ select 'Rp' || replace(to_char(n, 'FM999,999,999'), ',', '.') $$;
create or replace function voucher_disc(v vouchers, sub int) returns int language sql immutable as $$
  select case when v.kind = 'pct' then least(coalesce(v.max_disc, 2147483647), floor(sub * v.value / 100.0)::int) else least(v.value, sub) end $$;

create or replace function is_platform_admin() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from platform_admins where user_id = auth.uid()) $$;
create or replace function is_member(p_shop uuid) returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid()) or is_platform_admin() $$;
-- Toko aktif = masa coba belum habis, atau sudah bayar (toleransi 3 hari), dan tidak dibekukan.
create or replace function shop_active(s shops) returns boolean language sql stable as $$
  select not s.suspended and ((s.plan = 'trial' and s.trial_until > now()) or coalesce(s.paid_until, '-infinity') > now() - interval '3 days') $$;
-- Fitur Pro (QRIS otomatis, Kasir, promo, stok) = paket pro atau masih masa coba.
create or replace function shop_pro(s shops) returns boolean language sql stable as
  $$ select shop_active(s) and s.plan in ('pro', 'trial') $$;

-- ---------- 4. Pengaman kolom langganan ----------
create or replace function shops_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_platform_admin() then
    new.id := old.id; new.slug := old.slug; new.custom_domain := old.custom_domain; new.created_at := old.created_at;
    new.plan := old.plan; new.trial_until := old.trial_until; new.paid_until := old.paid_until; new.suspended := old.suspended;
  end if;
  return new;
end $$;
drop trigger if exists shops_guard on shops;
create trigger shops_guard before update on shops for each row execute function shops_guard();

-- ---------- 5. Hak akses (RLS): tiap pemilik hanya melihat warungnya ----------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('settings', 'menu_items', 'orders', 'pay_config', 'pay_log', 'vouchers',
             'blocked_phones', 'push_subs', 'push_cfg', 'shops', 'shop_members', 'platform_admins', 'kasir_keys') loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
alter table shops enable row level security;
alter table shop_members enable row level security;
alter table platform_admins enable row level security;
alter table kasir_keys enable row level security;
-- settings, pay_config: tabel lama, tidak dipakai lagi; tanpa policy = tertutup.

create policy shops_read on shops for select using (true);
create policy shops_owner on shops for update to authenticated using (is_member(id)) with check (is_member(id));
create policy members_read on shop_members for select to authenticated using (user_id = auth.uid() or is_platform_admin());
create policy admins_read on platform_admins for select to authenticated using (user_id = auth.uid());
create policy kasir_owner on kasir_keys for select to authenticated using (is_member(shop_id));
create policy menu_read on menu_items for select using (true);
create policy menu_owner on menu_items for all to authenticated using (is_member(shop_id)) with check (is_member(shop_id));
create policy orders_owner on orders for all to authenticated using (is_member(shop_id)) with check (is_member(shop_id));
create policy paylog_owner on pay_log for select to authenticated using (is_member(shop_id));
create policy vouchers_owner on vouchers for all to authenticated using (is_member(shop_id)) with check (is_member(shop_id));
create policy blocked_owner on blocked_phones for all to authenticated using (is_member(shop_id)) with check (is_member(shop_id));
create policy push_owner on push_subs for all to authenticated using (is_member(shop_id)) with check (is_member(shop_id));

grant select on shops, menu_items to anon, authenticated;
grant select, update on shops to authenticated;
grant all on menu_items, orders, vouchers, blocked_phones, push_subs to authenticated;
grant select on pay_log, kasir_keys, shop_members, platform_admins to authenticated;

-- Foto banner: disimpan di folder <shop_id>/..., hanya anggota warung itu yang boleh unggah/hapus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banner', 'banner', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true;
drop policy if exists banner_ins on storage.objects;
drop policy if exists banner_del on storage.objects;
drop policy if exists banner_sel on storage.objects;
create policy banner_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'banner' and (is_platform_admin() or ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and is_member(((storage.foldername(name))[1])::uuid))));
create policy banner_del on storage.objects for delete to authenticated
  using (bucket_id = 'banner' and (is_platform_admin() or ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and is_member(((storage.foldername(name))[1])::uuid))));
create policy banner_sel on storage.objects for select to authenticated using (bucket_id = 'banner');

-- ---------- 6. Fungsi publik (pembeli) ----------
-- Cari toko dari subdomain/slug atau domain sendiri. Mengembalikan data publik + status aktif.
create or replace function resolve_shop(p_host text default null, p_slug text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) || jsonb_build_object('active', shop_active(s), 'pro', shop_pro(s))
  from shops s
  where (p_slug is not null and s.slug = lower(p_slug))
     or (p_host is not null and s.custom_domain is not null and (s.custom_domain = lower(p_host) or 'www.' || s.custom_domain = lower(p_host)))
  order by (p_slug is not null and s.slug = lower(p_slug)) desc
  limit 1 $$;

create or replace function slug_available(p_slug text) returns boolean language sql stable security definer set search_path = public as $$
  select lower(p_slug) ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
     and lower(p_slug) not in ('www', 'app', 'api', 'admin', 'owner', 'pusat', 'daftar', 'mail', 'help', 'bantuan', 'toko', 'img', 'static', 'cdn', 'blog', 'w')
     and not exists (select 1 from shops where slug = lower(p_slug)) $$;

create or replace function pick_unique_code(p_shop uuid, p_base int) returns int language plpgsql volatile set search_path = public as $$
declare uc int;
begin
  for i in 1..80 loop
    uc := 1 + floor(random() * 199)::int;
    exit when not exists (select 1 from orders where shop_id = p_shop and payment = 'qris' and not paid and status <> 'batal'
                          and created_at > now() - interval '2 days'
                          and subtotal + coalesce(ongkir, 0) + coalesce(unique_code, 0) = p_base + uc);
  end loop;
  return uc;
end $$;

create or replace function place_order(p jsonb) returns table(order_code text, order_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  s shops; now_t time := (now() at time zone 'Asia/Jakarta')::time;
  it jsonb; m menu_items; q int; v text; sub int := 0; lines jsonb := '[]';
  o orders; lat double precision; lng double precision; km numeric; fee int := 0; link text;
  vc vouchers; disc int := 0; uc int; c text; ph text := norm_phone(p->>'phone');
begin
  select * into s from shops where id = (p->>'shop')::uuid;
  if not found then raise exception 'Toko tidak ditemukan.'; end if;
  if not shop_active(s) then raise exception 'Toko ini sedang tidak menerima pesanan online. Hubungi warung lewat WhatsApp.'; end if;
  if exists (select 1 from blocked_phones b where b.shop_id = s.id and b.phone = ph) then
    raise exception 'Nomor ini tidak bisa pesan online. Silakan hubungi warung lewat WhatsApp.';
  end if;
  if (select count(*) from orders where shop_id = s.id and norm_phone(phone) = ph and status in ('baru', 'dimasak', 'diantar', 'siap')) >= 3 then
    raise exception 'Masih ada 3 pesanan dari nomor ini yang belum selesai. Tunggu sebentar ya, atau hubungi warung lewat WhatsApp.';
  end if;
  if (select count(*) from orders where shop_id = s.id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Pesanan sedang ramai sekali. Coba lagi beberapa menit lagi ya.';
  end if;
  if not s.is_open or not in_window(now_t, s.open_time, s.close_time) then raise exception 'Maaf, warung sedang tutup.'; end if;
  if coalesce(p->>'method', '') not in ('delivery', 'cod', 'pickup') or coalesce(p->>'payment', '') not in ('tunai', 'qris') then
    raise exception 'Metode tidak valid';
  end if;
  if p->>'payment' = 'qris' and s.qris_payload is null then raise exception 'Pembayaran QRIS belum tersedia di toko ini. Pilih tunai ya.'; end if;
  if p->>'method' in ('delivery', 'cod') and not in_window(now_t, s.delivery_from, s.delivery_until) then
    raise exception 'Antar & COD hanya jam % sampai % WIB. Sekarang bisa ambil di tempat.', to_char(s.delivery_from, 'HH24.MI'), to_char(s.delivery_until, 'HH24.MI');
  end if;
  if coalesce(trim(p->>'name'), '') = '' or ph !~ '^08[0-9]{7,12}$' then raise exception 'Nama dan nomor WA wajib diisi dengan benar'; end if;
  if p->>'method' in ('delivery', 'cod') and coalesce(trim(p->>'address'), '') = '' then raise exception 'Detail alamat / patokan wajib diisi'; end if;

  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]')) loop
    select * into m from menu_items where id = (it->>'id')::int and shop_id = s.id and available;
    if not found or m.stock = 0 then raise exception 'Ada menu yang baru saja habis. Cek keranjang lagi ya.'; end if;
    q := greatest(1, least(50, coalesce((it->>'qty')::int, 1)));
    v := coalesce(it->>'variant', '');
    if cardinality(m.variants) > 0 and not (v = any(m.variants)) then v := m.variants[1]; end if;
    if cardinality(m.variants) = 0 then v := ''; end if;
    sub := sub + m.price * q;
    if m.stock is not null then
      update menu_items set stock = stock - q where id = m.id and stock >= q;
      if not found then raise exception 'Stok % tinggal %. Kurangi jumlahnya ya.', m.name, (select greatest(stock, 0) from menu_items where id = m.id); end if;
    end if;
    lines := lines || jsonb_build_object('id', m.id, 'name', m.name, 'variant', v, 'qty', q, 'price', m.price, 'unit', m.unit);
  end loop;
  if jsonb_array_length(lines) = 0 or jsonb_array_length(lines) > 30 then raise exception 'Keranjang tidak valid'; end if;

  if coalesce(trim(p->>'voucher'), '') <> '' then
    if not shop_pro(s) then raise exception 'Kode promo tidak berlaku.'; end if;
    select * into vc from vouchers where shop_id = s.id and code = upper(trim(p->>'voucher')) for update;
    if not found or not vc.active then raise exception 'Kode promo tidak ditemukan.'; end if;
    if vc.quota is not null and vc.used >= vc.quota then raise exception 'Kuota kode promo sudah habis.'; end if;
    if sub < vc.min_order then raise exception 'Kode % berlaku untuk belanja minimal %.', vc.code, rp_txt(vc.min_order); end if;
    disc := voucher_disc(vc, sub);
    update vouchers set used = used + 1 where shop_id = s.id and code = vc.code;
  end if;

  if p->>'method' in ('delivery', 'cod') and p ? 'lat' and p ? 'lng' then
    lat := (p->>'lat')::double precision; lng := (p->>'lng')::double precision;
    link := 'https://maps.google.com/?q=' || round(lat::numeric, 6) || ',' || round(lng::numeric, 6);
    if s.shop_lat is not null then
      km := ceil(greatest(coalesce((p->>'km')::numeric, 0), km_between(s.shop_lat, s.shop_lng, lat, lng)::numeric) * 10) / 10;
      km := greatest(km, 0.1);
      if s.max_km > 0 and km > s.max_km then
        raise exception 'Lokasi di luar jangkauan antar (maks % km). Pilih Ambil di tempat ya.', s.max_km;
      end if;
      fee := (ceil(km * s.ongkir_per_km / 500.0) * 500)::int;
      if s.free_ongkir_min > 0 and sub - disc >= s.free_ongkir_min then fee := 0; end if;
    end if;
  end if;

  if p->>'payment' = 'qris' then uc := pick_unique_code(s.id, sub - disc + fee); end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from orders where code = c);
  end loop;
  insert into orders (shop_id, code, name, phone, method, payment, address, maps_link, note, items, subtotal,
                      cust_lat, cust_lng, distance_km, ongkir, discount, voucher, unique_code)
  values (s.id, c, left(trim(p->>'name'), 60), left(regexp_replace(p->>'phone', '[^0-9+]', '', 'g'), 20), p->>'method', p->>'payment',
          left(p->>'address', 300), coalesce(link, left(p->>'maps_link', 300)), left(p->>'note', 300), lines, sub - disc,
          lat, lng, km, fee, disc, case when disc > 0 then vc.code end, uc)
  returning * into o;
  return query select o.code, o.token;
end $$;

create or replace function get_order(p_token uuid) returns setof orders language sql stable security definer set search_path = public as
  $$ select * from orders where token = p_token $$;

drop function if exists check_voucher(text, int);
create or replace function check_voucher(p_shop uuid, p_code text, p_sub int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v vouchers; s shops;
begin
  select * into s from shops where id = p_shop;
  if not found or not shop_pro(s) then return jsonb_build_object('ok', false, 'msg', 'Kode promo tidak ditemukan.'); end if;
  select * into v from vouchers where shop_id = p_shop and code = upper(trim(p_code));
  if not found or not v.active then return jsonb_build_object('ok', false, 'msg', 'Kode promo tidak ditemukan.'); end if;
  if v.quota is not null and v.used >= v.quota then return jsonb_build_object('ok', false, 'msg', 'Kuota kode promo ini sudah habis.'); end if;
  if p_sub < v.min_order then return jsonb_build_object('ok', false, 'msg', 'Kode ' || v.code || ' berlaku untuk belanja minimal ' || rp_txt(v.min_order) || '.'); end if;
  return jsonb_build_object('ok', true, 'code', v.code, 'disc', voucher_disc(v, p_sub));
end $$;

-- Stok kembali saat pesanan dibatalkan
create or replace function orders_restock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'batal' and old.status <> 'batal' then
    update menu_items mi set stock = mi.stock + x.qty
      from (select (l->>'id')::int id, sum((l->>'qty')::int) qty from jsonb_array_elements(new.items) l group by 1) x
     where mi.id = x.id and mi.shop_id = new.shop_id and mi.stock is not null;
  end if;
  return new;
end $$;

-- ---------- 7. Aplikasi Kasir (kode rahasia per warung) ----------
create or replace function dana_paid(p_secret text, p_text text) returns text
language plpgsql security definer set search_path = public as $$
declare k kasir_keys; s shops; amt int; raw text; n int; oc text;
begin
  select * into k from kasir_keys where secret = p_secret;
  if not found then return 'secret salah'; end if;
  update kasir_keys set last_ping = now() where shop_id = k.shop_id;
  select * into s from shops where id = k.shop_id;
  if p_text ilike 'TES koneksi%' then
    insert into pay_log (shop_id, raw, result) values (k.shop_id, left(p_text, 300), 'terhubung'); return 'terhubung';
  end if;
  if not shop_pro(s) then
    insert into pay_log (shop_id, raw, result) values (k.shop_id, left(p_text, 300), 'perlu paket pro'); return 'perlu paket pro';
  end if;
  raw := substring(p_text from '(?:Rp|IDR)\.?\s*([0-9][0-9.,]*)');
  if raw is null then
    insert into pay_log (shop_id, raw, result) values (k.shop_id, left(p_text, 300), 'tidak ada nominal'); return 'tidak ada nominal';
  end if;
  raw := regexp_replace(raw, '[.,]00$', '');
  amt := regexp_replace(raw, '[^0-9]', '', 'g')::int;
  select count(*), min(code) into n, oc from orders
   where shop_id = k.shop_id and payment = 'qris' and not paid and status <> 'batal' and created_at > now() - interval '2 days'
     and subtotal + coalesce(ongkir, 0) + coalesce(unique_code, 0) = amt;
  if n = 1 then
    update orders set paid = true where shop_id = k.shop_id and code = oc;
    insert into pay_log (shop_id, raw, result, amount, order_code) values (k.shop_id, left(p_text, 300), 'lunas', amt, oc);
    return 'lunas #' || oc;
  elsif n = 0 then
    insert into pay_log (shop_id, raw, result, amount) values (k.shop_id, left(p_text, 300), 'tidak cocok', amt); return 'tidak cocok';
  else
    insert into pay_log (shop_id, raw, result, amount) values (k.shop_id, left(p_text, 300), 'lebih dari satu cocok', amt); return 'lebih dari satu cocok';
  end if;
end $$;

create or replace function kasir_ping(p_secret text) returns text language plpgsql security definer set search_path = public as $$
begin
  update kasir_keys set last_ping = now() where secret = p_secret;
  return case when found then 'ok' else 'secret salah' end;
end $$;

drop function if exists kasir_orders(text, timestamptz);
create or replace function kasir_orders(p_secret text, p_after timestamptz)
returns table(code text, title text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare k kasir_keys;
begin
  select * into k from kasir_keys where secret = p_secret;
  if not found then return; end if;
  update kasir_keys set last_ping = now() where shop_id = k.shop_id;
  return query
  select o.code,
    'Pesanan baru #' || o.code || ' · ' || rp_txt(o.subtotal + coalesce(o.ongkir, 0) + coalesce(o.unique_code, 0)),
    coalesce((select string_agg((l->>'qty') || '× ' || (l->>'name') || case when coalesce(l->>'variant', '') <> '' then ' (' || (l->>'variant') || ')' else '' end, ', ')
              from jsonb_array_elements(o.items) l), '') || chr(10) ||
    o.name || ' · ' || case o.method when 'delivery' then 'Antar' when 'cod' then 'COD' else 'Ambil' end || ' · ' || upper(o.payment) ||
    case when coalesce(o.note, '') <> '' then chr(10) || 'Catatan: ' || o.note else '' end,
    o.created_at
  from orders o where o.shop_id = k.shop_id and o.created_at > p_after and o.created_at > now() - interval '1 hour'
  order by o.created_at limit 10;
end $$;

-- ---------- 8. Notifikasi browser (cadangan) ----------
create table if not exists push_cfg (id int primary key default 1 check (id = 1), vapid_public text, vapid_private text,
  hook_secret text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
alter table push_cfg enable row level security;
insert into push_cfg (id) values (1) on conflict do nothing;
create or replace function notify_push(body jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(url := 'https://wtmzvxmghlwukjwfvpmp.supabase.co/functions/v1/push', body := body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook', (select hook_secret from push_cfg where id = 1)));
exception when others then null;
end $$;
create or replace function orders_push() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_push(jsonb_build_object('shop_id', new.shop_id, 'code', new.code, 'name', new.name, 'method', new.method, 'payment', new.payment,
    'total', new.subtotal + coalesce(new.ongkir, 0) + coalesce(new.unique_code, 0), 'note', new.note,
    'items', (select string_agg((l->>'qty') || '× ' || (l->>'name') || case when coalesce(l->>'variant', '') <> '' then ' (' || (l->>'variant') || ')' else '' end, ', ')
              from jsonb_array_elements(new.items) l)));
  return new;
end $$;
drop function if exists push_test();
create or replace function push_test(p_shop uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_shop) then raise exception 'Bukan anggota warung ini'; end if;
  perform notify_push(jsonb_build_object('test', true, 'shop_id', p_shop));
end $$;

-- Pemicu pada pesanan: hapus semua yang lama (termasuk kode unik lama), pasang ulang yang dipakai.
do $$
declare r record;
begin
  for r in select tgname from pg_trigger where tgrelid = 'orders'::regclass and not tgisinternal loop
    execute format('drop trigger %I on orders', r.tgname);
  end loop;
end $$;
create trigger orders_push after insert on orders for each row execute function orders_push();
create trigger orders_restock after update of status on orders for each row execute function orders_restock();
drop function if exists set_unique_code();

-- ---------- 9. Pemilik warung ----------
create or replace function create_shop(p_name text, p_slug text, p_wa text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid;
begin
  if uid is null then raise exception 'Masuk dulu untuk membuat toko.'; end if;
  if (select count(*) from shop_members where user_id = uid) >= 3 then raise exception 'Satu akun maksimal 3 toko.'; end if;
  if not slug_available(p_slug) then raise exception 'Alamat toko itu sudah dipakai atau tidak valid. Pakai huruf kecil, angka, dan tanda minus.'; end if;
  if norm_phone(p_wa) !~ '^08[0-9]{7,12}$' then raise exception 'Nomor WA belum benar (contoh 0812xxxxxxx).'; end if;
  insert into shops (slug, name, wa) values (lower(p_slug), trim(p_name), '62' || substr(norm_phone(p_wa), 2)) returning id into sid;
  insert into shop_members (shop_id, user_id, role) values (sid, uid, 'owner');
  insert into kasir_keys (shop_id) values (sid);
  return sid;
end $$;

create or replace function my_shops() returns setof shops language sql stable security definer set search_path = public as $$
  select s.* from shops s join shop_members m on m.shop_id = s.id where m.user_id = auth.uid() order by s.created_at $$;

-- ---------- 10. Admin pusat (pemilik platform) ----------
create or replace function admin_shops() returns table(id uuid, slug text, name text, wa text, plan text, trial_until timestamptz,
  paid_until timestamptz, suspended boolean, active boolean, created_at timestamptz, owners text, orders_30d bigint, last_order timestamptz, kasir_ping timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'Khusus admin pusat'; end if;
  return query
  select s.id, s.slug, s.name, s.wa, s.plan, s.trial_until, s.paid_until, s.suspended, shop_active(s), s.created_at,
    (select string_agg(u.email, ', ') from shop_members m join auth.users u on u.id = m.user_id where m.shop_id = s.id),
    (select count(*) from orders o where o.shop_id = s.id and o.created_at > now() - interval '30 days'),
    (select max(o.created_at) from orders o where o.shop_id = s.id),
    (select k.last_ping from kasir_keys k where k.shop_id = s.id)
  from shops s order by s.created_at desc;
end $$;

create or replace function admin_update_shop(p_shop uuid, p_plan text, p_paid_until timestamptz, p_suspended boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'Khusus admin pusat'; end if;
  update shops set plan = coalesce(p_plan, plan), paid_until = p_paid_until, suspended = coalesce(p_suspended, suspended) where id = p_shop;
end $$;

revoke execute on function create_shop(text, text, text), my_shops(), admin_shops(), admin_update_shop(uuid, text, timestamptz, boolean), push_test(uuid) from public, anon;
grant execute on function create_shop(text, text, text), my_shops(), admin_shops(), admin_update_shop(uuid, text, timestamptz, boolean), push_test(uuid) to authenticated;
revoke execute on function notify_push(jsonb), pick_unique_code(uuid, int) from public, anon, authenticated;

-- Realtime: dashboard mendengarkan perubahan pesanan & pengaturan toko
do $$ begin
  begin alter publication supabase_realtime add table shops; exception when others then null; end;
end $$;

commit;
