do $$ begin create role anon nologin; exception when duplicate_object then null; end $$; do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create table public.brand_settings (id int primary key default 1, name text);
alter table public.brand_settings enable row level security;
create policy brand_read on public.brand_settings for select using (true);
insert into public.brand_settings values (1,'Indiki+');
