-- 002: tampilan per toko.
--   theme  : diatur pemilik (preset untuk semua paket; font, warna utama, pola latar khusus Pro)
--   design : diatur admin pusat saja (jasa desain khusus: CSS tambahan, gambar hero, catatan)
-- Aman dijalankan ulang.
alter table shops add column if not exists theme jsonb not null default '{}';
alter table shops add column if not exists design jsonb not null default '{}';

create or replace function shops_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_platform_admin() then
    new.id := old.id; new.slug := old.slug; new.custom_domain := old.custom_domain; new.created_at := old.created_at;
    new.plan := old.plan; new.trial_until := old.trial_until; new.paid_until := old.paid_until; new.suspended := old.suspended;
    new.design := old.design;
    -- Bukan Pro: hanya pilihan preset yang disimpan.
    if not shop_pro(new) then
      new.theme := case when new.theme ? 'preset' then jsonb_build_object('preset', new.theme->>'preset') else '{}'::jsonb end;
    end if;
  end if;
  return new;
end $$;

drop function if exists admin_update_design(uuid, jsonb);
create or replace function admin_update_design(p_shop uuid, p_design jsonb, p_theme jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'Khusus admin pusat'; end if;
  if length(coalesce(p_design->>'css', '')) > 20000 then raise exception 'CSS terlalu panjang (maks 20.000 karakter)'; end if;
  update shops set design = coalesce(p_design, '{}'::jsonb), theme = coalesce(p_theme, theme) where id = p_shop;
end $$;
revoke execute on function admin_update_design(uuid, jsonb, jsonb) from public, anon;
grant execute on function admin_update_design(uuid, jsonb, jsonb) to authenticated;

update shops set theme = '{"preset":"hangat"}' where slug = 'bhatra' and theme = '{}';
