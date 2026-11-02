-- =====================================================================
-- Indiki+  |  Esquema central (v1)
--
-- Princípios:
--  1. Nada se apaga. Toda chave estrangeira é ON DELETE RESTRICT e há um
--     gatilho que bloqueia DELETE. "Excluir" = preencher archived_at.
--  2. Quem acessa o quê é decidido no banco (RLS + funções), não no site.
--  3. As telas NÃO escrevem direto nas tabelas. Só chamam funções (RPC) que
--     validam regra de negócio. O papel "authenticated" só tem SELECT.
--  4. Tudo que muda dinheiro ou etapa deixa rastro (histórico + auditoria).
--
-- Papéis:
--  - Indicador (cliente/profissional): vê só as próprias indicações e comissões
--    e confirma se recebeu ou não.
--  - Empresa (membro): vê as indicações da sua empresa e SÓ muda a etapa.
--  - Plataforma (admin Indiki+): fecha o mês, registra pagamento, resolve disputas.
--
-- Rodar no SQL Editor do Supabase, uma vez por projeto/ambiente.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.commission_type   as enum ('fixed', 'percent');
  create type public.referral_stage    as enum ('indicado', 'orcamento', 'fechou', 'instalada', 'paga', 'perdido');
  create type public.referral_source   as enum ('link', 'declarado', 'direto');
  create type public.commission_status as enum ('pendente', 'liberada', 'paga', 'confirmada', 'contestada', 'cancelada');
  create type public.member_role       as enum ('admin', 'operador');
  create type public.batch_status      as enum ('aberto', 'pago');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- Pessoa (indicador, membro de empresa ou admin). 1:1 com auth.users.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete restrict,
  full_name     text not null check (length(btrim(full_name)) > 0),
  phone         text,
  profile_kind  text not null default 'cliente' check (profile_kind in ('cliente', 'profissional')),
  pix_key       text,
  pix_key_type  text check (pix_key_type in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);

create table if not exists public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- Empresa cliente do Indiki+.
create table if not exists public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(btrim(name)) > 0),
  legal_name       text,
  cnpj             text unique,
  platform_fee_bps int  not null default 100 check (platform_fee_bps between 0 and 10000), -- 100 = 1%
  status           text not null default 'ativa' check (status in ('ativa', 'suspensa')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz
);

-- Quem da empresa acessa o painel dela.
create table if not exists public.company_members (
  company_id  uuid not null references public.companies (id) on delete restrict,
  user_id     uuid not null references public.profiles (id)  on delete restrict,
  role        public.member_role not null default 'operador',
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Produto/serviço com regra de comissão.
create table if not exists public.offers (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete restrict,
  name              text not null check (length(btrim(name)) > 0),
  description       text,
  commission_type   public.commission_type not null,
  commission_value  int  not null check (commission_value > 0), -- fixed: centavos | percent: pontos-base (500 = 5%)
  grace_days        int  not null default 30 check (grace_days >= 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  unique (company_id, name),
  unique (id, company_id)
);

-- Link/código do indicador EM UMA empresa. Uma pessoa pode ter vários (um por empresa).
create table if not exists public.referrer_links (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete restrict,
  user_id        uuid not null references public.profiles (id)  on delete restrict,
  code           text not null unique check (code ~ '^[A-Z0-9-]{4,24}$'),
  active         boolean not null default true,
  customer_since date,
  created_at     timestamptz not null default now(),
  archived_at    timestamptz,
  unique (company_id, user_id),
  unique (id, company_id)
);

-- Indicação (o pedido de orçamento do amigo).
create table if not exists public.referrals (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies (id) on delete restrict,
  offer_id                 uuid not null,
  link_id                  uuid,
  source                   public.referral_source not null,
  declared_referrer_name   text,
  declared_referrer_phone  text,
  declared_confirmed_at    timestamptz,
  friend_name              text not null check (length(btrim(friend_name)) > 0),
  friend_phone             text not null check (length(btrim(friend_phone)) > 0),
  consent_at               timestamptz not null,          -- LGPD: consentimento de quem pediu o orçamento
  consent_version          text not null,
  stage                    public.referral_stage not null default 'indicado',
  stage_changed_at         timestamptz not null default now(),
  sale_value_cents         int check (sale_value_cents is null or sale_value_cents >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  archived_at              timestamptz,
  unique (id, company_id),
  foreign key (offer_id, company_id) references public.offers (id, company_id) on delete restrict,
  foreign key (link_id,  company_id) references public.referrer_links (id, company_id) on delete restrict,
  constraint referral_source_ok check (
    (source = 'link'      and link_id is not null) or
    (source = 'declarado' and declared_referrer_name is not null) or
    (source = 'direto'    and link_id is null)
  ),
  -- Sem indicador confirmado não existe venda por indicação: não há comissão sem alguém para receber.
  constraint referral_needs_referrer check (
    stage in ('indicado', 'orcamento', 'perdido') or link_id is not null
  )
);

-- Histórico de cada mudança de etapa (só cresce).
create table if not exists public.referral_stage_history (
  id          bigint generated always as identity primary key,
  referral_id uuid not null references public.referrals (id) on delete restrict,
  from_stage  public.referral_stage,
  to_stage    public.referral_stage not null,
  changed_by  uuid references public.profiles (id) on delete restrict,
  note        text,
  changed_at  timestamptz not null default now()
);

-- Fechamento mensal de pagamentos (pago no último dia do mês).
create table if not exists public.payout_batches (
  id          uuid primary key default gen_random_uuid(),
  month_ref   date not null unique check (extract(day from month_ref) = 1),
  status      public.batch_status not null default 'aberto',
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);

-- Comissão: uma por indicação.
create table if not exists public.commissions (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null unique,
  company_id    uuid not null,
  link_id       uuid not null,
  amount_cents  int  not null check (amount_cents >= 0),   -- valor "congelado" na hora da venda
  status        public.commission_status not null default 'pendente',
  release_date  date,
  batch_id      uuid references public.payout_batches (id) on delete restrict,
  paid_at       timestamptz,
  confirmed_at  timestamptz,
  contested_at  timestamptz,
  contest_note  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (referral_id, company_id) references public.referrals (id, company_id) on delete restrict,
  foreign key (link_id, company_id)     references public.referrer_links (id, company_id) on delete restrict,
  constraint commission_paid_needs_batch check (status not in ('paga', 'confirmada') or batch_id is not null)
);

-- Auditoria geral (só cresce).
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text,
  action     text not null,
  old_data   jsonb,
  new_data   jsonb,
  actor      uuid,
  at         timestamptz not null default now()
);

-- Índices nas chaves estrangeiras e nas consultas das telas.
create index if not exists idx_company_members_user  on public.company_members (user_id);
create index if not exists idx_offers_company        on public.offers (company_id);
create index if not exists idx_links_user            on public.referrer_links (user_id);
create index if not exists idx_referrals_company     on public.referrals (company_id, created_at desc);
create index if not exists idx_referrals_link        on public.referrals (link_id);
create index if not exists idx_referrals_offer       on public.referrals (offer_id, company_id);
create index if not exists idx_history_referral      on public.referral_stage_history (referral_id, changed_at);
create index if not exists idx_commissions_link      on public.commissions (link_id, status);
create index if not exists idx_commissions_company   on public.commissions (company_id, status);
create index if not exists idx_commissions_batch     on public.commissions (batch_id);
create index if not exists idx_audit_table_row       on public.audit_log (table_name, row_id);

-- ---------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.forbid_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Exclusão bloqueada em %. Use archived_at para arquivar.', tg_table_name
    using errcode = 'restrict_violation';
end $$;

create or replace function public.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% é somente-inserção: não pode ser alterada nem apagada.', tg_table_name
    using errcode = 'restrict_violation';
end $$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create or replace function public.is_company_member(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company and user_id = auth.uid()
  )
$$;

-- Registra quem fez o quê.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb; v_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', concat_ws(':', v_new ->> 'company_id', v_new ->> 'user_id'));
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
  values (tg_table_name, v_id, tg_op, v_old, v_new, auth.uid());
  return null;
end $$;

-- Campos que nunca mudam depois de criados.
create or replace function public.referral_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.company_id <> old.company_id or new.offer_id <> old.offer_id
     or new.friend_name <> old.friend_name or new.friend_phone <> old.friend_phone
     or new.consent_at <> old.consent_at or new.consent_version <> old.consent_version
     or new.created_at <> old.created_at then
    raise exception 'Dados originais da indicação não podem ser alterados.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create or replace function public.commission_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.amount_cents <> old.amount_cents or new.referral_id <> old.referral_id
     or new.link_id <> old.link_id or new.company_id <> old.company_id then
    raise exception 'Valor e vínculos da comissão não podem ser alterados.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

-- Histórico automático de etapa.
create or replace function public.log_stage_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.referral_stage_history (referral_id, from_stage, to_stage, changed_by)
    values (new.id, null, new.stage, auth.uid());
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    insert into public.referral_stage_history (referral_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end $$;

-- Cria o perfil quando alguém se cadastra no Supabase Auth.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, profile_kind)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Usuário'),
    case when new.raw_user_meta_data ->> 'profile_kind' = 'profissional' then 'profissional' else 'cliente' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  -- 1) Nunca apagar
  foreach t in array array['profiles','platform_admins','companies','company_members','offers',
                           'referrer_links','referrals','payout_batches','commissions'] loop
    execute format('drop trigger if exists trg_no_delete on public.%I', t);
    execute format('create trigger trg_no_delete before delete on public.%I for each row execute function public.forbid_delete()', t);
  end loop;
  -- 2) Tabelas de registro: só inserir
  foreach t in array array['referral_stage_history','audit_log'] loop
    execute format('drop trigger if exists trg_append_only on public.%I', t);
    execute format('create trigger trg_append_only before update or delete on public.%I for each row execute function public.forbid_change()', t);
  end loop;
  -- 3) updated_at
  foreach t in array array['profiles','companies','offers','referrals','commissions'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
  -- 4) Auditoria
  foreach t in array array['profiles','platform_admins','companies','company_members','offers',
                           'referrer_links','referrals','payout_batches','commissions'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

drop trigger if exists trg_referral_immutable on public.referrals;
create trigger trg_referral_immutable before update on public.referrals
  for each row execute function public.referral_immutable();

drop trigger if exists trg_commission_immutable on public.commissions;
create trigger trg_commission_immutable before update on public.commissions
  for each row execute function public.commission_immutable();

drop trigger if exists trg_stage_history_ins on public.referrals;
create trigger trg_stage_history_ins after insert on public.referrals
  for each row execute function public.log_stage_change();

drop trigger if exists trg_stage_history_upd on public.referrals;
create trigger trg_stage_history_upd before update on public.referrals
  for each row execute function public.log_stage_change();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Funções de negócio (as ÚNICAS portas de escrita das telas)
-- ---------------------------------------------------------------------

-- Amigo pede orçamento. Pode ser chamada sem login (página pública).
create or replace function public.submit_quote_request(
  p_friend_name text,
  p_friend_phone text,
  p_offer_id uuid,
  p_consent boolean,
  p_consent_version text,
  p_code text default null,                 -- veio pelo link de um indicador
  p_company_id uuid default null,           -- sem link: informar a empresa
  p_declared_referrer_name text default null,
  p_declared_referrer_phone text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.referrer_links;
  v_company uuid;
  v_source public.referral_source;
  v_id uuid;
begin
  if not coalesce(p_consent, false) then
    raise exception 'É necessário concordar com o uso dos dados para pedir o orçamento.';
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    select * into v_link from public.referrer_links
      where code = upper(btrim(p_code)) and active and archived_at is null;
    if not found then raise exception 'Link de indicação inválido.'; end if;
    v_company := v_link.company_id;
    v_source := 'link';
  else
    v_company := p_company_id;
    if v_company is null then raise exception 'Informe a empresa.'; end if;
    v_source := case when nullif(btrim(coalesce(p_declared_referrer_name, '')), '') is not null
                     then 'declarado' else 'direto' end;
  end if;

  if not exists (select 1 from public.companies where id = v_company and status = 'ativa' and archived_at is null) then
    raise exception 'Empresa indisponível.';
  end if;
  if not exists (select 1 from public.offers where id = p_offer_id and company_id = v_company and active and archived_at is null) then
    raise exception 'Produto indisponível nesta empresa.';
  end if;

  insert into public.referrals (
    company_id, offer_id, link_id, source, declared_referrer_name, declared_referrer_phone,
    friend_name, friend_phone, consent_at, consent_version
  ) values (
    v_company, p_offer_id, v_link.id, v_source,
    case when v_source = 'declarado' then btrim(p_declared_referrer_name) end,
    case when v_source = 'declarado' then nullif(btrim(coalesce(p_declared_referrer_phone, '')), '') end,
    btrim(p_friend_name), btrim(p_friend_phone), now(), p_consent_version
  ) returning id into v_id;
  return v_id;
end $$;

-- EMPRESA: muda a etapa. É a única coisa que a empresa pode alterar.
create or replace function public.company_set_referral_stage(
  p_referral uuid,
  p_stage public.referral_stage,
  p_sale_value_cents int default null,       -- obrigatório na passagem para "fechou"
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.referrals;
  o public.offers;
  v_admin boolean := public.is_platform_admin();
  v_from int; v_to int;
  v_amount int;
begin
  select * into r from public.referrals where id = p_referral for update;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  if not (v_admin or public.is_company_member(r.company_id)) then
    raise exception 'Sem permissão para esta indicação.' using errcode = 'insufficient_privilege';
  end if;
  if r.archived_at is not null then raise exception 'Indicação arquivada.'; end if;
  if p_stage = r.stage then return; end if;

  if p_stage = 'paga' and not v_admin then
    raise exception 'A etapa "paga" é registrada pelo Indiki+ no pagamento mensal.';
  end if;

  if not v_admin then
    if r.stage in ('paga', 'perdido') then
      raise exception 'Esta indicação já foi encerrada.';
    end if;
    if p_stage = 'perdido' then
      if r.stage = 'instalada' then raise exception 'Obra instalada e paga não pode ser marcada como perdida.'; end if;
    else
      v_from := array_position(array['indicado','orcamento','fechou','instalada','paga']::text[], r.stage::text);
      v_to   := array_position(array['indicado','orcamento','fechou','instalada','paga']::text[], p_stage::text);
      if v_to <> v_from + 1 then
        raise exception 'A etapa só avança uma de cada vez (de % para %).', r.stage, p_stage;
      end if;
    end if;
  end if;

  if p_stage in ('fechou', 'instalada', 'paga') and r.link_id is null then
    raise exception 'Esta indicação ainda não tem indicador confirmado.';
  end if;

  select * into o from public.offers where id = r.offer_id;

  if p_stage = 'fechou' then
    -- O valor da venda é sempre obrigatório: dele saem a taxa do Indiki+ (1%) e a comissão percentual.
    if coalesce(p_sale_value_cents, r.sale_value_cents) is null or coalesce(p_sale_value_cents, r.sale_value_cents) <= 0 then
      raise exception 'Informe o valor da venda ao marcar como fechada.';
    end if;
    v_amount := case o.commission_type
      when 'fixed'   then o.commission_value
      else round(coalesce(p_sale_value_cents, r.sale_value_cents)::numeric * o.commission_value / 10000)::int
    end;
    update public.referrals
       set stage = p_stage, sale_value_cents = coalesce(p_sale_value_cents, sale_value_cents)
     where id = r.id;
    insert into public.commissions (referral_id, company_id, link_id, amount_cents, status)
    values (r.id, r.company_id, r.link_id, v_amount, 'pendente')
    on conflict (referral_id) do nothing;
  else
    update public.referrals set stage = p_stage where id = r.id;
  end if;

  if p_stage = 'instalada' then
    update public.commissions
       set release_date = current_date + o.grace_days
     where referral_id = r.id and status = 'pendente';
  elsif p_stage = 'perdido' then
    update public.commissions set status = 'cancelada' where referral_id = r.id and status in ('pendente', 'liberada');
  end if;

  if p_note is not null then
    insert into public.audit_log (table_name, row_id, action, new_data, actor)
    values ('referrals', r.id::text, 'NOTE', jsonb_build_object('stage', p_stage, 'note', p_note), auth.uid());
  end if;
end $$;

-- INDICADOR: confirma (ou não) uma indicação que um amigo declarou em nome dele.
create or replace function public.indicator_answer_declared(p_referral uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare r public.referrals; v_link uuid; v_phone text;
begin
  select * into r from public.referrals where id = p_referral for update;
  if not found or r.source <> 'declarado' or r.declared_confirmed_at is not null or r.link_id is not null then
    raise exception 'Indicação não encontrada ou já respondida.';
  end if;
  select id into v_link from public.referrer_links
    where company_id = r.company_id and user_id = auth.uid() and active and archived_at is null;
  select phone into v_phone from public.profiles where id = auth.uid();
  if v_link is null then raise exception 'Você não é indicador desta empresa.' using errcode = 'insufficient_privilege'; end if;
  if r.declared_referrer_phone is null or v_phone is null
     or regexp_replace(r.declared_referrer_phone, '\D', '', 'g') <> regexp_replace(v_phone, '\D', '', 'g') then
    raise exception 'Esta indicação não foi feita em seu nome.' using errcode = 'insufficient_privilege';
  end if;
  if p_accept then
    update public.referrals set link_id = v_link, declared_confirmed_at = now() where id = r.id;
  else
    update public.referrals set source = 'direto', declared_referrer_name = null, declared_referrer_phone = null where id = r.id;
  end if;
end $$;

-- INDICADOR: confirma se recebeu ou não. Só vale para comissão já paga.
create or replace function public.indicator_respond_commission(p_commission uuid, p_received boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare c public.commissions;
begin
  select c2.* into c from public.commissions c2
    join public.referrer_links l on l.id = c2.link_id
   where c2.id = p_commission and l.user_id = auth.uid() for update of c2;
  if not found then raise exception 'Comissão não encontrada.' using errcode = 'insufficient_privilege'; end if;
  if c.status <> 'paga' then raise exception 'Só dá para responder quando o pagamento foi informado.'; end if;
  if p_received then
    update public.commissions set status = 'confirmada', confirmed_at = now() where id = c.id;
  else
    update public.commissions set status = 'contestada', contested_at = now(), contest_note = p_note where id = c.id;
  end if;
end $$;

-- INDICADOR: troca a própria chave PIX / telefone.
create or replace function public.indicator_update_payment_info(p_pix_key text, p_pix_key_type text, p_phone text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
     set pix_key = nullif(btrim(p_pix_key), ''), pix_key_type = p_pix_key_type,
         phone = coalesce(nullif(btrim(p_phone), ''), phone)
   where id = auth.uid();
end $$;

-- PLATAFORMA: libera comissões cujo prazo de segurança já passou.
create or replace function public.admin_release_due_commissions() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'Somente a plataforma.' using errcode = 'insufficient_privilege'; end if;
  update public.commissions set status = 'liberada'
   where status = 'pendente' and release_date is not null and release_date <= current_date;
  get diagnostics n = row_count;
  return n;
end $$;

-- PLATAFORMA: fecha o mês (agrupa as liberadas) e registra o pagamento.
create or replace function public.admin_pay_month(p_month date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_batch uuid; v_month date := date_trunc('month', p_month)::date;
begin
  if not public.is_platform_admin() then raise exception 'Somente a plataforma.' using errcode = 'insufficient_privilege'; end if;
  insert into public.payout_batches (month_ref) values (v_month)
    on conflict (month_ref) do nothing;
  select id into v_batch from public.payout_batches where month_ref = v_month for update;
  update public.commissions
     set status = 'paga', batch_id = v_batch, paid_at = now()
   where status = 'liberada';
  update public.referrals r set stage = 'paga'
    from public.commissions c
   where c.referral_id = r.id and c.batch_id = v_batch and r.stage = 'instalada';
  update public.payout_batches set status = 'pago', paid_at = now() where id = v_batch;
  return v_batch;
end $$;

-- PLATAFORMA: resolve disputa (volta a "paga" para o indicador responder de novo, ou cancela).
create or replace function public.admin_resolve_dispute(p_commission uuid, p_back_to_paid boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Somente a plataforma.' using errcode = 'insufficient_privilege'; end if;
  update public.commissions
     set status = case when p_back_to_paid then 'paga'::public.commission_status else 'cancelada'::public.commission_status end,
         contested_at = null, contest_note = null
   where id = p_commission and status = 'contestada';
  if not found then raise exception 'Comissão não está contestada.'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Visões (o que cada papel enxerga)
-- ---------------------------------------------------------------------

-- Nome do amigo reduzido: "Carla Mendes" -> "Carla M."
create or replace function public.short_name(p text) returns text
language sql immutable set search_path = '' as $$
  select case when position(' ' in btrim(p)) > 0
              then split_part(btrim(p), ' ', 1) || ' ' || upper(left(split_part(btrim(p), ' ', 2), 1)) || '.'
              else btrim(p) end
$$;

-- Indicador: só as próprias indicações, sem telefone/endereço/valores do amigo.
create or replace view public.indicator_referrals as
select r.id, r.company_id, c.name as company_name, o.name as offer_name,
       public.short_name(r.friend_name) as friend, r.stage, r.source, r.created_at
  from public.referrals r
  join public.referrer_links l on l.id = r.link_id
  join public.companies c on c.id = r.company_id
  join public.offers o on o.id = r.offer_id
 where l.user_id = auth.uid() and r.archived_at is null;

-- Indicador: comissões próprias (valor que ele vai receber, nunca o valor da venda).
create or replace view public.indicator_commissions as
select m.id, m.company_id, c.name as company_name, o.name as offer_name,
       public.short_name(r.friend_name) as friend, m.amount_cents, m.status,
       m.release_date, m.paid_at, m.confirmed_at, m.created_at
  from public.commissions m
  join public.referrer_links l on l.id = m.link_id
  join public.referrals r on r.id = m.referral_id
  join public.companies c on c.id = m.company_id
  join public.offers o on o.id = r.offer_id
 where l.user_id = auth.uid();

-- Indicador: seus links (um por empresa).
create or replace view public.indicator_links as
select l.id, l.company_id, c.name as company_name, l.code, l.customer_since
  from public.referrer_links l
  join public.companies c on c.id = l.company_id
 where l.user_id = auth.uid() and l.archived_at is null;

-- Indicador: pedidos em que um amigo disse ter sido indicado por ele (aguardam resposta).
create or replace view public.indicator_pending_declarations as
select r.id, r.company_id, c.name as company_name, public.short_name(r.friend_name) as friend, r.created_at
  from public.referrals r
  join public.companies c on c.id = r.company_id
  join public.referrer_links l on l.company_id = r.company_id and l.user_id = auth.uid() and l.active
  join public.profiles p on p.id = auth.uid()
 where r.source = 'declarado' and r.link_id is null and r.declared_confirmed_at is null
   and r.declared_referrer_phone is not null and p.phone is not null
   and regexp_replace(r.declared_referrer_phone, '\D', '', 'g') = regexp_replace(p.phone, '\D', '', 'g');

-- Empresa: indicações da própria empresa, com o nome do indicador (nunca a chave PIX dele).
create or replace view public.company_referrals as
select r.id, r.company_id, o.name as offer_name, r.friend_name, r.friend_phone, r.stage,
       r.source, r.sale_value_cents, r.created_at, r.stage_changed_at,
       p.full_name as referrer_name, r.declared_referrer_name
  from public.referrals r
  join public.offers o on o.id = r.offer_id
  left join public.referrer_links l on l.id = r.link_id
  left join public.profiles p on p.id = l.user_id
 where (public.is_company_member(r.company_id) or public.is_platform_admin()) and r.archived_at is null;

-- Empresa: comissões da própria empresa (quanto deve, a quem, em que status).
create or replace view public.company_commissions as
select m.id, m.company_id, m.referral_id, p.full_name as referrer_name, m.amount_cents,
       m.status, m.release_date, m.paid_at, m.created_at
  from public.commissions m
  join public.referrer_links l on l.id = m.link_id
  join public.profiles p on p.id = l.user_id
 where public.is_company_member(m.company_id) or public.is_platform_admin();

-- Empresa: quanto deve ao Indiki+ (taxa sobre vendas já realizadas).
create or replace view public.company_platform_fees as
select c.id as company_id, c.name, c.platform_fee_bps,
       coalesce(sum(r.sale_value_cents) filter (where r.stage in ('fechou','instalada','paga')), 0) as sales_cents,
       round(coalesce(sum(r.sale_value_cents) filter (where r.stage in ('fechou','instalada','paga')), 0)::numeric
             * c.platform_fee_bps / 10000)::bigint as fee_cents
  from public.companies c
  left join public.referrals r on r.company_id = c.id
 where public.is_company_member(c.id) or public.is_platform_admin()
 group by c.id;

-- Público (sem login): empresas e produtos ativos, para o formulário de orçamento.
create or replace view public.public_offers as
select c.id as company_id, c.name as company_name, o.id as offer_id, o.name as offer_name
  from public.offers o
  join public.companies c on c.id = o.company_id
 where o.active and o.archived_at is null and c.status = 'ativa' and c.archived_at is null;

-- ---------------------------------------------------------------------
-- Segurança de linha (RLS) e permissões
-- ---------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.platform_admins         enable row level security;
alter table public.companies               enable row level security;
alter table public.company_members         enable row level security;
alter table public.offers                  enable row level security;
alter table public.referrer_links          enable row level security;
alter table public.referrals               enable row level security;
alter table public.referral_stage_history  enable row level security;
alter table public.payout_batches          enable row level security;
alter table public.commissions             enable row level security;
alter table public.audit_log               enable row level security;

drop policy if exists p_profiles_self      on public.profiles;
drop policy if exists p_companies_member   on public.companies;
drop policy if exists p_members_self       on public.company_members;
drop policy if exists p_offers_member      on public.offers;
drop policy if exists p_links_self         on public.referrer_links;
drop policy if exists p_referrals_member   on public.referrals;
drop policy if exists p_history_member     on public.referral_stage_history;
drop policy if exists p_commissions_member on public.commissions;
drop policy if exists p_batches_admin      on public.payout_batches;
drop policy if exists p_audit_admin        on public.audit_log;
drop policy if exists p_admins_admin       on public.platform_admins;

create policy p_profiles_self      on public.profiles       for select to authenticated using (id = auth.uid() or public.is_platform_admin());
create policy p_companies_member   on public.companies     for select to authenticated using (public.is_company_member(id) or public.is_platform_admin());
create policy p_members_self       on public.company_members for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy p_offers_member      on public.offers         for select to authenticated using (public.is_company_member(company_id) or public.is_platform_admin());
create policy p_links_self         on public.referrer_links for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy p_referrals_member   on public.referrals     for select to authenticated using (public.is_company_member(company_id) or public.is_platform_admin());
create policy p_history_member     on public.referral_stage_history for select to authenticated using (
  exists (select 1 from public.referrals r where r.id = referral_id and (public.is_company_member(r.company_id) or public.is_platform_admin())));
create policy p_commissions_member on public.commissions    for select to authenticated using (public.is_company_member(company_id) or public.is_platform_admin());
create policy p_batches_admin      on public.payout_batches for select to authenticated using (public.is_platform_admin());
create policy p_audit_admin        on public.audit_log      for select to authenticated using (public.is_platform_admin());
create policy p_admins_admin       on public.platform_admins for select to authenticated using (public.is_platform_admin());

-- Ninguém escreve direto: remove tudo e devolve só o necessário.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Identidade visual segue pública (já existia).
grant select on public.brand_settings to anon, authenticated;

-- Tabelas: só leitura, filtrada pelas políticas acima.
grant select on public.profiles, public.platform_admins, public.companies, public.company_members,
                public.offers, public.referrer_links, public.referrals, public.referral_stage_history,
                public.payout_batches, public.commissions, public.audit_log
  to authenticated;

-- Visões por papel.
grant select on public.indicator_referrals, public.indicator_commissions, public.indicator_links,
                public.indicator_pending_declarations,
                public.company_referrals, public.company_commissions, public.company_platform_fees
  to authenticated;
grant select on public.public_offers to anon, authenticated;

-- Funções: quem pode chamar o quê.
grant execute on function public.submit_quote_request(text, text, uuid, boolean, text, text, uuid, text, text) to anon, authenticated;
grant execute on function public.is_platform_admin(), public.is_company_member(uuid), public.short_name(text) to authenticated;
grant execute on function public.company_set_referral_stage(uuid, public.referral_stage, int, text) to authenticated;
grant execute on function public.indicator_answer_declared(uuid, boolean) to authenticated;
grant execute on function public.indicator_respond_commission(uuid, boolean, text) to authenticated;
grant execute on function public.indicator_update_payment_info(text, text, text) to authenticated;
grant execute on function public.admin_release_due_commissions() to authenticated;
grant execute on function public.admin_pay_month(date) to authenticated;
grant execute on function public.admin_resolve_dispute(uuid, boolean) to authenticated;
