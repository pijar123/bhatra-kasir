-- Perkiraan struktur database BHATRA saat ini (versi satu warung), untuk menguji migrasi 001.
create table settings(
  id int primary key default 1 check (id = 1), is_open boolean not null default true,
  open_time time not null default '10:00', close_time time not null default '22:30', delivery_until time not null default '20:00',
  ongkir_per_km int not null default 1000, shop_lat double precision, shop_lng double precision, max_km numeric default 10,
  delivery_from time not null default '10:00', categories text[] not null default array['Paket Nasi','Lauk','Tambahan','Minuman'],
  banners text[] not null default '{}', prep_min int not null default 20, free_ongkir_min int not null default 0);
create table menu_items(id serial primary key, category text not null, name text not null, variants text[] not null default '{}',
  price int not null, unit text, available boolean not null default true, sort int not null default 0,
  price_before int, stock int, featured boolean not null default false);
create table orders(id uuid primary key default gen_random_uuid(), code text unique not null default upper(substr(md5(random()::text), 1, 5)),
  token uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), name text, phone text, method text, payment text,
  address text, maps_link text, note text, items jsonb, subtotal int, distance_km numeric, ongkir int, status text not null default 'baru',
  paid boolean not null default false, cust_lat double precision, cust_lng double precision, unique_code int, discount int not null default 0, voucher text);
create table pay_config(id int primary key default 1 check (id = 1), secret text not null default encode(gen_random_bytes(12), 'hex'), last_ping timestamptz);
create table pay_log(id bigserial primary key, at timestamptz not null default now(), raw text, result text, amount int, order_code text);
create table vouchers(code text primary key, kind text not null default 'rp', value int not null, min_order int not null default 0, max_disc int, quota int,
  used int not null default 0, active boolean not null default true, created_at timestamptz default now());
create table blocked_phones(phone text primary key, note text, created_at timestamptz default now());
create table push_subs(endpoint text primary key, sub jsonb not null, created_at timestamptz default now(), ua text);
create table push_cfg(id int primary key default 1 check (id = 1), vapid_public text, vapid_private text, hook_secret text not null default 'h00k');

alter table settings enable row level security; alter table menu_items enable row level security; alter table orders enable row level security;
alter table pay_config enable row level security; alter table pay_log enable row level security; alter table vouchers enable row level security;
alter table blocked_phones enable row level security; alter table push_subs enable row level security; alter table push_cfg enable row level security;
create policy set_read on settings for select using (true);
create policy set_admin on settings for update to authenticated using (true);
create policy menu_read on menu_items for select using (true);
create policy menu_admin on menu_items for all to authenticated using (true) with check (true);
create policy orders_admin on orders for all to authenticated using (true) with check (true);
create policy pay_admin on pay_config for all to authenticated using (true);
create policy paylog_admin on pay_log for select to authenticated using (true);
create policy vouchers_admin on vouchers for all to authenticated using (true) with check (true);
create policy blocked_admin on blocked_phones for all to authenticated using (true) with check (true);
create policy push_admin on push_subs for all to authenticated using (true) with check (true);

create or replace function set_unique_code() returns trigger language plpgsql as $$
begin if new.payment = 'qris' and new.unique_code is null then new.unique_code := 1 + floor(random() * 199)::int; end if; return new; end $$;
create trigger set_unique_code before insert on orders for each row execute function set_unique_code();
create or replace function place_order(p jsonb) returns table(order_code text, order_token uuid) language plpgsql security definer as $$
declare o orders; begin insert into orders(name) values (p->>'name') returning * into o; return query select o.code, o.token; end $$;
create or replace function check_voucher(p_code text, p_sub int) returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function push_test() returns void language sql as $$ select $$;
create or replace function kasir_ping(p_secret text) returns text language sql as $$ select 'ok' $$;
alter publication supabase_realtime add table orders;

insert into settings(id, shop_lat, shop_lng) values (1, -7.7, 109.4);
insert into menu_items(category, name, variants, price, sort, featured) values
  ('Paket Nasi', 'Nasi Ayam Goreng Bawang Putih', array['Original','Geprek'], 16000, 1, true),
  ('Minuman', 'Es Teh', '{}', 3000, 1, false);
insert into pay_config(secret) values ('aaaaaaaaaaaaaaaaaaaaaaaa');
insert into orders(name, phone, method, payment, items, subtotal, status) values ('Lama', '081200000000', 'pickup', 'tunai', '[]', 16000, 'selesai');
insert into vouchers(code, value) values ('HEMAT5', 5000);
insert into auth.users(id, email) values ('11111111-1111-4111-8111-111111111111', 'istri@contoh.id');
