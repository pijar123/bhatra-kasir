-- =====================================================================
-- Platform pesan online banyak warung (turunan sistem BHATRA)
-- Jalankan sekali di proyek Supabase BARU (SQL Editor), urut dari atas.
-- Semua data dipisah per warung lewat shop_id + Row Level Security.
-- =====================================================================

create extension if not exists pg_net;

-- ---------- helper umum ----------
create or replace function norm_phone(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '^62', '0') $$;

create or replace function rp_txt(n int) returns text language sql immutable as $$
  select 'Rp' || replace(to_char(n, 'FM999,999,999'), ',', '.') $$;

-- jam t berada di antara s..e (boleh lewat tengah malam; s = e berarti 24 jam)
create or replace function in_window(t time, s time, e time) returns boolean language sql immutable as $$
  select case when s = e then true when s < e then t >= s and t <= e else t >= s or t <= e end $$;

create or replace function km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))) $$;

-- ---------- tabel ----------
create table if not exists platform_admins (user_id uuid primary key references auth.users on delete cascade);

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  name text not null check (length(name) between 2 and 60),
  tagline text not null default '',
  wa text not null,
  address text not null default '',
  pickup_note text not null default '',
  logo_url text,
  accent text not null default '#C8372D' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  plan text not null default 'pro' check (plan in ('dasar', 'pro')),
  trial_until timestamptz not null default now() + interval '14 days',
  paid_until timestamptz,
  is_open boolean not null default true,
  open_time time not null default '10:00',
  close_time time not null default '21:00',
  delivery_from time not null default '10:00',
  delivery_until time not null default '20:00',
  ongkir_per_km int not null default 1000,
  max_km numeric not null default 10,
  free_ongkir_min int not null default 0,
  prep_min int not null default 20,
  shop_lat double precision,
  shop_lng double precision,
  categories text[] not null default array['Makanan', 'Minuman'],
  banners text[] not null default '{}',
  qris_static text,
  qris_merchant text,
  kasir_secret text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  last_ping timestamptz,
  owner_id uuid not null references auth.users,
  created_at timestamptz not null default now()
);

create table if not exists shop_members (
  shop_id uuid not null references shops on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  primary key (shop_id, user_id)
);

create table if not exists menu_items (
  id bigserial primary key,
  shop_id uuid not null references shops on delete cascade,
  category text not null,
  name text not null,
  variants text[] not null default '{}',
  price int not null check (price >= 0),
  price_before int,
  unit text not null default '',
  available boolean not null default true,
  featured boolean not null default false,
  stock int,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists menu_items_shop on menu_items (shop_id, sort);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops on delete cascade,
  code text not null,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null, phone text not null,
  method text not null check (method in ('delivery', 'cod', 'pickup')),
  payment text not null check (payment in ('tunai', 'qris')),
  address text not null default '', maps_link text, note text not null default '',
  items jsonb not null,
  subtotal int not null, discount int not null default 0, voucher text,
  distance_km numeric, ongkir int not null default 0, unique_code int not null default 0,
  cust_lat double precision, cust_lng double precision,
  status text not null default 'baru' check (status in ('baru', 'dimasak', 'diantar', 'siap', 'selesai', 'batal')),
  paid boolean not null default false,
  unique (shop_id, code)
);
create index if not exists orders_shop_time on orders (shop_id, created_at desc);

create table if not exists vouchers (
  shop_id uuid not null references shops on delete cascade,
  code text not null,
  kind text not null default 'rp' check (kind in ('rp', 'pct')),
  value int not null check (value > 0),
  min_order int not null default 0, max_disc int, quota int,
  used int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (shop_id, code)
);

create table if not exists blocked_phones (
  shop_id uuid not null references shops on delete cascade,
  phone text not null, note text, created_at timestamptz not null default now(),
  primary key (shop_id, phone)
);

create table if not exists pay_log (
  id bigserial primary key,
  shop_id uuid not null references shops on delete cascade,
  at timestamptz not null default now(),
  raw text, amount int, result text, order_code text
);

create table if not exists push_subs (
  endpoint text primary key,
  shop_id uuid not null references shops on delete cascade,
  sub jsonb not null, ua text, created_at timestamptz not null default now()
);

-- catatan pembayaran langganan (diisi admin platform)
create table if not exists billing_log (
  id bigserial primary key,
  shop_id uuid not null references shops on delete cascade,
  plan text not null, months int not null, amount int not null default 0,
  paid_until timestamptz not null, note text, created_at timestamptz not null default now()
);

create table if not exists push_cfg (
  id int primary key default 1 check (id = 1), vapid_public text, vapid_private text,
  push_url text, -- isi: https://<ref>.supabase.co/functions/v1/push
  hook_secret text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
insert into push_cfg (id) values (1) on conflict do nothing;

-- ---------- status langganan ----------
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid()) $$;

create or replace function is_member(p_shop uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid()) or is_admin() $$;

-- aktif = masa coba atau langganan masih berjalan (+3 hari tenggang)
create or replace function shop_active(s shops) returns boolean language sql stable as $$
  select now() < greatest(s.trial_until, coalesce(s.paid_until, '-infinity'::timestamptz)) + interval '3 days' $$;

-- fitur Pro: selama masa coba, atau langganan Pro aktif
create or replace function shop_pro(s shops) returns boolean language sql stable as $$
  select now() < s.trial_until or (s.plan = 'pro' and now() < coalesce(s.paid_until, '-infinity'::timestamptz) + interval '3 days') $$;

-- ---------- RLS ----------
alter table platform_admins enable row level security;
alter table shops enable row level security;
alter table shop_members enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table vouchers enable row level security;
alter table blocked_phones enable row level security;
alter table pay_log enable row level security;
alter table push_subs enable row level security;
alter table billing_log enable row level security;
alter table push_cfg enable row level security;

drop policy if exists shops_member on shops;
create policy shops_member on shops for select to authenticated using (is_member(id));
drop policy if exists shops_update on shops;
create policy shops_update on shops for update to authenticated using (is_member(id)) with check (is_member(id));

drop policy if exists members_self on shop_members;
create policy members_self on shop_members for select to authenticated using (user_id = auth.uid() or is_member(shop_id));

do $$ declare t text; begin
  foreach t in array array['menu_items', 'orders', 'vouchers', 'blocked_phones', 'push_subs'] loop
    execute format('drop policy if exists %1$s_member on %1$s', t);
    execute format('create policy %1$s_member on %1$s for all to authenticated using (is_member(shop_id)) with check (is_member(shop_id))', t);
  end loop;
end $$;
drop policy if exists pay_log_member on pay_log;
create policy pay_log_member on pay_log for select to authenticated using (is_member(shop_id));
drop policy if exists billing_member on billing_log;
create policy billing_member on billing_log for select to authenticated using (is_member(shop_id));

-- owner tidak boleh mengubah kolom langganan & identitas toko
create or replace function shops_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() kosong = SQL editor / service role (admin teknis); owner biasa tidak bisa mengubah kolom ini
  if auth.uid() is not null and not is_admin() then
    new.slug := old.slug; new.plan := old.plan; new.trial_until := old.trial_until; new.paid_until := old.paid_until;
    new.kasir_secret := old.kasir_secret; new.owner_id := old.owner_id; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists shops_guard on shops;
create trigger shops_guard before update on shops for each row execute function shops_guard();

-- ---------- daftar toko ----------
create or replace function slug_available(p_slug text) returns boolean language sql stable security definer set search_path = public as $$
  select lower(p_slug) ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
     and lower(p_slug) <> all (array['www', 'app', 'api', 'admin', 'owner', 'super', 'daftar', 'masuk', 'login', 'mail',
                                     'toko', 'help', 'bantuan', 'status', 'blog', 'cdn', 'static', 'img', 'assets', 'dev', 'test'])
     and not exists (select 1 from shops where slug = lower(p_slug)) $$;
grant execute on function slug_available(text) to anon, authenticated;

create or replace function create_shop(p_slug text, p_name text, p_wa text) returns text
language plpgsql security definer set search_path = public as $$
declare s shops; wa text := regexp_replace(coalesce(p_wa, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Masuk dulu ya.'; end if;
  if (select count(*) from shops where owner_id = auth.uid()) >= 3 then raise exception 'Satu akun maksimal 3 toko.'; end if;
  if not slug_available(p_slug) then raise exception 'Link "%" sudah dipakai atau tidak boleh. Coba nama lain.', lower(p_slug); end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Nama toko belum diisi.'; end if;
  if wa !~ '^(62|0)8[0-9]{7,12}$' then raise exception 'Nomor WA belum benar (contoh 0812xxxxxxx).'; end if;
  if wa like '0%' then wa := '62' || substr(wa, 2); end if;
  insert into shops (slug, name, wa, owner_id) values (lower(p_slug), trim(p_name), wa, auth.uid()) returning * into s;
  insert into shop_members (shop_id, user_id, role) values (s.id, auth.uid(), 'owner');
  return s.slug;
end $$;
grant execute on function create_shop(text, text, text) to authenticated;

-- ---------- halaman pembeli ----------
create or replace function shop_public(p_slug text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'tagline', s.tagline, 'wa', s.wa, 'address', s.address,
    'pickup_note', s.pickup_note, 'logo_url', s.logo_url, 'accent', s.accent,
    'active', shop_active(s), 'pro', shop_pro(s),
    'is_open', s.is_open, 'open_time', s.open_time, 'close_time', s.close_time,
    'delivery_from', s.delivery_from, 'delivery_until', s.delivery_until,
    'ongkir_per_km', s.ongkir_per_km, 'max_km', s.max_km, 'free_ongkir_min', case when shop_pro(s) then s.free_ongkir_min else 0 end,
    'prep_min', s.prep_min, 'shop_lat', s.shop_lat, 'shop_lng', s.shop_lng,
    'categories', s.categories, 'banners', case when shop_pro(s) then s.banners else '{}' end,
    'qris', s.qris_static is not null, 'qris_static', s.qris_static,
    'menu', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'category', m.category, 'name', m.name, 'variants', m.variants,
              'price', m.price, 'price_before', case when shop_pro(s) then m.price_before end, 'unit', m.unit,
              'available', m.available, 'featured', m.featured, 'stock', case when shop_pro(s) then m.stock end) order by m.sort, m.id)
              from menu_items m where m.shop_id = s.id), '[]'::jsonb))
  from shops s where s.slug = lower(p_slug) $$;
grant execute on function shop_public(text) to anon, authenticated;

create or replace function voucher_disc(v vouchers, sub int) returns int language sql immutable as $$
  select case when v.kind = 'pct' then least(coalesce(v.max_disc, 2147483647), floor(sub * v.value / 100.0)::int) else least(v.value, sub) end $$;

create or replace function check_voucher(p_slug text, p_code text, p_sub int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops; v vouchers;
begin
  select * into s from shops where slug = lower(p_slug);
  if not found or not shop_pro(s) then return jsonb_build_object('ok', false, 'msg', 'Kode promo tidak ditemukan.'); end if;
  select * into v from vouchers where shop_id = s.id and code = upper(trim(p_code));
  if not found or not v.active then return jsonb_build_object('ok', false, 'msg', 'Kode promo tidak ditemukan.'); end if;
  if v.quota is not null and v.used >= v.quota then return jsonb_build_object('ok', false, 'msg', 'Kuota kode promo ini sudah habis.'); end if;
  if p_sub < v.min_order then return jsonb_build_object('ok', false, 'msg', 'Kode ' || v.code || ' berlaku untuk belanja minimal ' || rp_txt(v.min_order) || '.'); end if;
  return jsonb_build_object('ok', true, 'code', v.code, 'disc', voucher_disc(v, p_sub));
end $$;
grant execute on function check_voucher(text, text, int) to anon, authenticated;

-- ---------- pesan ----------
create or replace function place_order(p_slug text, p jsonb) returns table (order_code text, order_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  s shops; now_t time := (now() at time zone 'Asia/Jakarta')::time;
  it jsonb; m menu_items; q int; v text; sub int := 0; lines jsonb := '[]'; o orders;
  lat double precision; lng double precision; km numeric; fee int := 0; link text;
  vc vouchers; disc int := 0; uc int := 0; cd text; ph text := norm_phone(p->>'phone');
begin
  select * into s from shops where slug = lower(p_slug);
  if not found then raise exception 'Toko tidak ditemukan.'; end if;
  if not shop_active(s) then raise exception 'Toko ini sedang tidak menerima pesanan online. Hubungi lewat WhatsApp ya.'; end if;
  if exists (select 1 from blocked_phones b where b.shop_id = s.id and b.phone = ph) then
    raise exception 'Nomor ini tidak bisa pesan online. Silakan hubungi warung lewat WhatsApp.'; end if;
  if (select count(*) from orders where shop_id = s.id and norm_phone(phone) = ph and status in ('baru', 'dimasak', 'diantar', 'siap')) >= 3 then
    raise exception 'Masih ada 3 pesanan dari nomor ini yang belum selesai. Tunggu sebentar ya.'; end if;
  if (select count(*) from orders where shop_id = s.id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Pesanan sedang ramai sekali. Coba lagi beberapa menit lagi ya.'; end if;
  if not s.is_open or not in_window(now_t, s.open_time, s.close_time) then raise exception 'Maaf, warung sedang tutup.'; end if;
  if p->>'method' not in ('delivery', 'cod', 'pickup') or p->>'payment' not in ('tunai', 'qris') then raise exception 'Metode tidak valid'; end if;
  if p->>'payment' = 'qris' and s.qris_static is null then raise exception 'Warung ini belum menerima QRIS. Pilih tunai ya.'; end if;
  if p->>'method' in ('delivery', 'cod') and not in_window(now_t, s.delivery_from, s.delivery_until) then
    raise exception 'Antar & COD hanya jam % sampai % WIB. Sekarang bisa ambil sendiri.', to_char(s.delivery_from, 'HH24.MI'), to_char(s.delivery_until, 'HH24.MI'); end if;
  if coalesce(trim(p->>'name'), '') = '' or ph !~ '^08[0-9]{7,12}$' then raise exception 'Nama dan nomor WA wajib diisi dengan benar.'; end if;
  if p->>'method' in ('delivery', 'cod') and coalesce(trim(p->>'address'), '') = '' then raise exception 'Detail alamat / patokan wajib diisi'; end if;

  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]')) loop
    select * into m from menu_items where id = (it->>'id')::bigint and shop_id = s.id and available;
    if not found then raise exception 'Ada menu yang baru saja habis. Cek keranjang lagi ya.'; end if;
    q := greatest(1, least(50, coalesce((it->>'qty')::int, 1)));
    v := coalesce(it->>'variant', '');
    if cardinality(m.variants) > 0 and not (v = any (m.variants)) then v := m.variants[1]; end if;
    if cardinality(m.variants) = 0 then v := ''; end if;
    sub := sub + m.price * q;
    if m.stock is not null and shop_pro(s) then
      update menu_items set stock = stock - q where id = m.id and stock >= q;
      if not found then raise exception 'Stok % tinggal %. Kurangi jumlahnya ya.', m.name, (select greatest(stock, 0) from menu_items where id = m.id); end if;
    end if;
    lines := lines || jsonb_build_object('id', m.id, 'name', m.name, 'variant', v, 'qty', q, 'price', m.price, 'unit', m.unit);
  end loop;
  if jsonb_array_length(lines) = 0 or jsonb_array_length(lines) > 30 then raise exception 'Keranjang tidak valid'; end if;

  if coalesce(trim(p->>'voucher'), '') <> '' and shop_pro(s) then
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
      km := greatest(ceil(greatest(coalesce((p->>'km')::numeric, 0), km_between(s.shop_lat, s.shop_lng, lat, lng)::numeric) * 10) / 10, 0.1);
      if s.max_km > 0 and km > s.max_km then raise exception 'Lokasi di luar jangkauan antar (maks % km). Pilih ambil sendiri ya.', s.max_km; end if;
      fee := (ceil(km * s.ongkir_per_km / 500.0) * 500)::int;
      if shop_pro(s) and s.free_ongkir_min > 0 and sub - disc >= s.free_ongkir_min then fee := 0; end if;
    end if;
  end if;

  -- kode unik QRIS 1..199 yang tidak bentrok dengan pesanan QRIS lain yang belum lunas
  if p->>'payment' = 'qris' then
    select n into uc from generate_series(1, 199) n
     where not exists (select 1 from orders x where x.shop_id = s.id and x.payment = 'qris' and not x.paid and x.status <> 'batal'
                         and x.created_at > now() - interval '2 days' and x.subtotal + x.ongkir + x.unique_code = sub - disc + fee + n)
     order by random() limit 1;
    uc := coalesce(uc, 1 + floor(random() * 199)::int);
  end if;

  loop
    cd := upper(substr(md5(random()::text), 1, 5));
    exit when not exists (select 1 from orders where shop_id = s.id and code = cd);
  end loop;

  insert into orders (shop_id, code, name, phone, method, payment, address, maps_link, note, items, subtotal, discount, voucher,
                      cust_lat, cust_lng, distance_km, ongkir, unique_code)
  values (s.id, cd, left(trim(p->>'name'), 60), left(regexp_replace(p->>'phone', '[^0-9+]', '', 'g'), 20), p->>'method', p->>'payment',
          left(coalesce(p->>'address', ''), 300), coalesce(link, left(p->>'maps_link', 300)), left(coalesce(p->>'note', ''), 300),
          lines, sub - disc, disc, case when disc > 0 then vc.code end, lat, lng, km, fee, uc)
  returning * into o;
  return query select o.code, o.token;
end $$;
grant execute on function place_order(text, jsonb) to anon, authenticated;

create or replace function get_order(p_token uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(o) - 'cust_lat' - 'cust_lng' || jsonb_build_object('shop', jsonb_build_object(
           'slug', s.slug, 'name', s.name, 'wa', s.wa, 'logo_url', s.logo_url, 'accent', s.accent,
           'prep_min', s.prep_min, 'qris_static', s.qris_static, 'pickup_note', s.pickup_note))
  from orders o join shops s on s.id = o.shop_id where o.token = p_token $$;
grant execute on function get_order(uuid) to anon, authenticated;

-- stok kembali bila pesanan dibatalkan
create or replace function orders_restock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'batal' and old.status <> 'batal' then
    update menu_items mi set stock = mi.stock + x.qty
      from (select (l->>'id')::bigint id, sum((l->>'qty')::int) qty from jsonb_array_elements(new.items) l group by 1) x
     where mi.id = x.id and mi.shop_id = new.shop_id and mi.stock is not null;
  end if;
  return new;
end $$;
drop trigger if exists orders_restock on orders;
create trigger orders_restock after update of status on orders for each row execute function orders_restock();

-- ---------- aplikasi Kasir (QRIS otomatis + bunyi pesanan) ----------
create or replace function dana_paid(p_secret text, p_text text) returns text
language plpgsql security definer set search_path = public as $$
declare s shops; raw text; amt int; n int; oc text;
begin
  select * into s from shops where kasir_secret = p_secret;
  if not found then return 'secret salah'; end if;
  update shops set last_ping = now() where id = s.id;
  if p_text ilike 'TES koneksi%' then insert into pay_log (shop_id, raw, result) values (s.id, left(p_text, 300), 'terhubung'); return 'terhubung'; end if;
  if not shop_pro(s) then insert into pay_log (shop_id, raw, result) values (s.id, left(p_text, 300), 'perlu paket Pro'); return 'perlu paket Pro'; end if;
  raw := substring(p_text from '(?:Rp|IDR)\.?\s*([0-9][0-9.,]*)');
  if raw is null then insert into pay_log (shop_id, raw, result) values (s.id, left(p_text, 300), 'tidak ada nominal'); return 'tidak ada nominal'; end if;
  raw := regexp_replace(raw, '[.,]00$', '');
  amt := regexp_replace(raw, '[^0-9]', '', 'g')::int;
  select count(*), min(code) into n, oc from orders
   where shop_id = s.id and payment = 'qris' and not paid and status <> 'batal' and created_at > now() - interval '2 days'
     and subtotal + ongkir + unique_code = amt;
  if n = 1 then
    update orders set paid = true where shop_id = s.id and code = oc;
    insert into pay_log (shop_id, raw, amount, result, order_code) values (s.id, left(p_text, 300), amt, 'lunas', oc);
    return 'lunas #' || oc;
  end if;
  insert into pay_log (shop_id, raw, amount, result) values (s.id, left(p_text, 300), amt, case when n = 0 then 'tidak cocok' else 'nominal ganda' end);
  return case when n = 0 then 'tidak cocok' else 'nominal ganda' end;
end $$;
grant execute on function dana_paid(text, text) to anon, authenticated;

create or replace function kasir_ping(p_secret text) returns text language plpgsql security definer set search_path = public as $$
begin
  update shops set last_ping = now() where kasir_secret = p_secret;
  return case when found then 'ok' else 'secret salah' end;
end $$;
grant execute on function kasir_ping(text) to anon, authenticated;

create or replace function kasir_orders(p_secret text, p_after timestamptz)
returns table (code text, title text, body text, created_at timestamptz) language plpgsql security definer set search_path = public as $$
declare s shops;
begin
  select * into s from shops where kasir_secret = p_secret;
  if not found then return; end if;
  update shops set last_ping = now() where id = s.id;
  return query
  select o.code, 'Pesanan baru #' || o.code || ' · ' || rp_txt(o.subtotal + o.ongkir + o.unique_code),
    coalesce((select string_agg((l->>'qty') || '× ' || (l->>'name') || case when coalesce(l->>'variant', '') <> '' then ' (' || (l->>'variant') || ')' else '' end, ', ')
              from jsonb_array_elements(o.items) l), '') || chr(10) || o.name || ' · ' ||
    case o.method when 'delivery' then 'Antar' when 'cod' then 'COD' else 'Ambil' end || ' · ' || upper(o.payment) ||
    case when o.note <> '' then chr(10) || 'Catatan: ' || o.note else '' end,
    o.created_at
  from orders o where o.shop_id = s.id and o.created_at > p_after and o.created_at > now() - interval '1 hour'
  order by o.created_at limit 10;
end $$;
grant execute on function kasir_orders(text, timestamptz) to anon, authenticated;

-- ---------- notifikasi browser (web push) ----------
create or replace function notify_push(body jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select push_url from push_cfg where id = 1) is null then return; end if;
  perform net.http_post(url := (select push_url from push_cfg where id = 1), body := body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook', (select hook_secret from push_cfg where id = 1)));
exception when others then null;
end $$;
revoke all on function notify_push(jsonb) from public, anon, authenticated;

create or replace function orders_push() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_push(jsonb_build_object('shop_id', new.shop_id, 'code', new.code, 'name', new.name, 'method', new.method,
    'payment', new.payment, 'note', new.note, 'total', new.subtotal + new.ongkir + new.unique_code,
    'items', (select string_agg((l->>'qty') || '× ' || (l->>'name'), ', ') from jsonb_array_elements(new.items) l)));
  return new;
end $$;
drop trigger if exists orders_push on orders;
create trigger orders_push after insert on orders for each row execute function orders_push();

create or replace function push_test(p_shop uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_shop) then raise exception 'Tidak diizinkan'; end if;
  perform notify_push(jsonb_build_object('shop_id', p_shop, 'test', true));
end $$;
grant execute on function push_test(uuid) to authenticated;

-- ---------- admin platform ----------
create or replace function admin_shops() returns table (
  id uuid, slug text, name text, wa text, plan text, trial_until timestamptz, paid_until timestamptz, active boolean,
  created_at timestamptz, orders_30d bigint, last_order timestamptz, last_ping timestamptz, owner_email text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'Khusus admin platform'; end if;
  return query
  select s.id, s.slug, s.name, s.wa, s.plan, s.trial_until, s.paid_until, shop_active(s), s.created_at,
         (select count(*) from orders o where o.shop_id = s.id and o.created_at > now() - interval '30 days'),
         (select max(o.created_at) from orders o where o.shop_id = s.id), s.last_ping,
         (select u.email::text from auth.users u where u.id = s.owner_id)
  from shops s order by s.created_at desc;
end $$;
grant execute on function admin_shops() to authenticated;

-- catat pembayaran langganan: perpanjang dari tanggal habis (atau dari sekarang kalau sudah lewat)
create or replace function admin_extend(p_shop uuid, p_plan text, p_months int, p_amount int, p_note text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare s shops; base timestamptz; until_ts timestamptz;
begin
  if not is_admin() then raise exception 'Khusus admin platform'; end if;
  if p_plan not in ('dasar', 'pro') or p_months not between 1 and 24 then raise exception 'Paket atau lama tidak valid'; end if;
  select * into s from shops where id = p_shop for update;
  base := greatest(now(), coalesce(s.paid_until, now()));
  until_ts := base + make_interval(months => p_months);
  update shops set plan = p_plan, paid_until = until_ts where id = p_shop;
  insert into billing_log (shop_id, plan, months, amount, paid_until, note) values (p_shop, p_plan, p_months, coalesce(p_amount, 0), until_ts, p_note);
  return until_ts;
end $$;
grant execute on function admin_extend(uuid, text, int, int, text) to authenticated;

-- ---------- penyimpanan gambar (logo, banner) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop', 'shop', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];
drop policy if exists shop_files_ins on storage.objects;
drop policy if exists shop_files_del on storage.objects;
drop policy if exists shop_files_sel on storage.objects;
create policy shop_files_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'shop' and is_member(((storage.foldername(name))[1])::uuid));
create policy shop_files_del on storage.objects for delete to authenticated
  using (bucket_id = 'shop' and is_member(((storage.foldername(name))[1])::uuid));
create policy shop_files_sel on storage.objects for select to authenticated
  using (bucket_id = 'shop' and is_member(((storage.foldername(name))[1])::uuid));

-- ---------- realtime pesanan untuk dashboard ----------
do $$ begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null; end $$;
