-- Tambahan khusus e2e: auth.uid dari JWT PostgREST, peran authenticator, jam buka 24 jam.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                         current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid $$;
alter table auth.users add column if not exists pw text;
update shops set open_time = '00:00', close_time = '23:59', delivery_until = '23:59', is_open = true;
update auth.users set pw = 'rahasia123' where email = 'istri@contoh.id';
insert into auth.users(id, email, pw) values ('22222222-2222-4222-8222-222222222222', 'admin@contoh.id', 'rahasia123') on conflict do nothing;
insert into platform_admins(user_id) values ('22222222-2222-4222-8222-222222222222') on conflict do nothing;
notify pgrst, 'reload schema';
