-- Tiruan minimal lingkungan Supabase untuk menguji schema.sql di PostgreSQL biasa
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage; create schema net;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create table net.calls (id serial, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id $$;
create publication supabase_realtime;
grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
