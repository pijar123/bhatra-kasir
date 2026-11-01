-- 003: pemantauan. Error dari browser pembeli/pemilik dicatat, dan ada cek kesehatan untuk GitHub Actions.
-- Aman dijalankan ulang.
create table if not exists client_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  shop_id uuid references shops(id) on delete cascade,
  page text, msg text not null, src text, ua text
);
create index if not exists client_errors_at on client_errors(at desc);
alter table client_errors enable row level security;
revoke all on client_errors from anon, authenticated;

-- Siapa pun boleh melapor, dengan batas: pesan dipotong, maks 300 laporan/jam untuk semua toko.
create or replace function log_client_error(p_shop uuid, p_page text, p_msg text, p_src text, p_ua text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_msg is null or length(trim(p_msg)) = 0 then return; end if;
  if (select count(*) from client_errors where at > now() - interval '1 hour') >= 300 then return; end if;
  insert into client_errors(shop_id, page, msg, src, ua)
  values ((select id from shops where id = p_shop), left(p_page, 200), left(p_msg, 500), left(p_src, 300), left(p_ua, 200));
  delete from client_errors where at < now() - interval '30 days';
end $$;
grant execute on function log_client_error(uuid, text, text, text, text) to anon, authenticated;

-- Untuk admin pusat: error terbaru (dikelompokkan per pesan).
create or replace function admin_errors(p_hours int default 24) returns table(msg text, page text, shop text, n bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'Khusus admin pusat'; end if;
  return query select e.msg, max(e.page), max(s.name), count(*), max(e.at)
    from client_errors e left join shops s on s.id = e.shop_id
    where e.at > now() - make_interval(hours => p_hours)
    group by e.msg order by max(e.at) desc limit 50;
end $$;
revoke execute on function admin_errors(int) from public, anon;
grant execute on function admin_errors(int) to authenticated;

-- Cek kesehatan (dipanggil GitHub Actions tiap jam). Tidak membuka data pribadi; hanya angka & nama toko.
--   kasir_mati : toko Pro yang pernah menghubungkan HP kasir, sedang jam buka, tapi HP-nya tidak lapor > 60 menit
--   error_1jam : jumlah error browser 1 jam terakhir
create or replace function health() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ok', true,
    'toko_aktif', (select count(*) from shops s where shop_active(s)),
    'kasir_mati', coalesce((select jsonb_agg(s.name) from shops s join kasir_keys k on k.shop_id = s.id
       where shop_pro(s) and s.is_open and k.last_ping is not null and k.last_ping < now() - interval '60 minutes'
         and in_window((now() at time zone 'Asia/Jakarta')::time, s.open_time, s.close_time)), '[]'::jsonb),
    'error_1jam', (select count(*) from client_errors where at > now() - interval '1 hour'))
$$;
grant execute on function health() to anon, authenticated;
