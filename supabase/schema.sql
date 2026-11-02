-- Identidade visual parametrizável do Indiki+ (protótipo).
-- Rode no SQL Editor do Supabase.

create table if not exists public.brand_settings (
  id             int primary key default 1,
  name           text not null default 'Indiki+',
  tagline        text not null default 'Indique, venda e ganhe.',
  logo_url       text,
  color_primary  text not null default '#0f766e',
  color_primary_fg text not null default '#ffffff',
  color_accent   text not null default '#f59e0b',
  color_surface  text not null default '#f8fafc',
  color_ink      text not null default '#0f172a',
  radius_px      int  not null default 12,
  updated_at     timestamptz not null default now(),
  constraint brand_single_row check (id = 1)
);

insert into public.brand_settings (id) values (1)
on conflict (id) do nothing;

-- Leitura pública (o site precisa ler para se pintar); escrita só por service role / painel admin.
alter table public.brand_settings enable row level security;

drop policy if exists "brand_read_all" on public.brand_settings;
create policy "brand_read_all" on public.brand_settings
  for select using (true);

-- Exemplo para trocar a identidade sem mexer em código:
-- update public.brand_settings
--   set name = 'Minha Marca', color_primary = '#4f46e5', color_accent = '#ec4899', updated_at = now()
--   where id = 1;
