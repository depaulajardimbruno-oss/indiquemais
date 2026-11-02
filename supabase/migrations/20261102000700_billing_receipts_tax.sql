-- =====================================================================
-- Indiki+ — Cobrança dos planos, recibos e base fiscal
--   1) Faturas (mensalidade do plano + taxa sobre vendas), pagamentos e RECIBOS numerados
--   2) Dados fiscais do indicador (CPF) e REGRAS DE RETENÇÃO parametrizadas
--   3) Registro de cada pagamento de comissão (bruto, retenções, líquido)
--   4) INFORME DE RENDIMENTOS anual do indicador (versionado) e resumo anual pago pela empresa
--
-- IMPORTANTE (jurídico/fiscal): este arquivo cria a ESTRUTURA. As regras de retenção
-- (IRRF, INSS, ISS), os dados da empresa emissora (CNPJ, razão social) e a emissão de nota
-- fiscal de serviço precisam ser definidos com o contador. Até lá, as regras nascem
-- DESATIVADAS e as taxas em zero. O recibo aqui NÃO substitui a nota fiscal.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Configurações e numeração de documentos
-- ---------------------------------------------------------------------
insert into public.platform_settings (key, value, description) values
  ('invoice_due_days',        '10',    'Prazo de vencimento das faturas, em dias.'),
  ('require_cpf_for_payout',  'false', 'Se "true", comissão só é paga a indicador com CPF cadastrado.'),
  ('issuer_legal_name',       '',      'Razão social do Indiki+ (aparece no recibo). Preencher com o contador.'),
  ('issuer_cnpj',             '',      'CNPJ do Indiki+ (aparece no recibo e no informe). Preencher com o contador.')
on conflict (key) do nothing;

create table if not exists public.document_counters (
  kind        text not null,
  year        int  not null,
  last_number int  not null default 0,
  primary key (kind, year)
);
alter table public.document_counters enable row level security;
revoke all on public.document_counters from anon, authenticated;

-- Próximo número, sem buracos nem repetição: F-2026-000001, R-2026-000001, IR-2026-000001
create or replace function public.next_doc_number(p_kind text, p_prefix text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_year int := extract(year from now() at time zone 'America/Sao_Paulo')::int; v_n int;
begin
  insert into public.document_counters (kind, year, last_number) values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last_number = public.document_counters.last_number + 1
  returning last_number into v_n;
  return p_prefix || '-' || v_year || '-' || lpad(v_n::text, 6, '0');
end $$;

-- ---------------------------------------------------------------------
-- 1) FATURAS, PAGAMENTOS E RECIBOS
-- ---------------------------------------------------------------------
create table if not exists public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  company_id         uuid not null references public.companies (id) on delete restrict,
  kind               text not null check (kind in ('mensalidade', 'taxa_vendas')),
  period_month       date not null check (extract(day from period_month) = 1),
  plan_code          text references public.plans (code) on delete restrict,   -- plano no momento da fatura
  description        text not null,
  amount_cents       int  not null check (amount_cents >= 0),
  status             text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  due_date           date not null,
  issued_at          timestamptz not null default now(),
  paid_at            timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  fiscal_note_number text,        -- número da nota fiscal de serviço (emitida fora, pelo contador/emissor)
  fiscal_note_url    text,
  created_by         uuid references public.profiles (id) on delete restrict,
  check ((status = 'paga') = (paid_at is not null)),
  check ((status = 'cancelada') = (cancelled_at is not null)),
  check (status <> 'cancelada' or length(coalesce(cancel_reason, '')) >= 5)
);
-- Uma fatura ativa por empresa, tipo e mês (cancelada libera gerar de novo).
create unique index if not exists uq_invoice_company_kind_month on public.invoices (company_id, kind, period_month) where status <> 'cancelada';
create index if not exists idx_invoices_company on public.invoices (company_id, period_month desc);

-- Itens: no caso da taxa sobre vendas, uma linha por venda (cada venda é cobrada uma única vez).
create table if not exists public.invoice_items (
  id           bigint generated always as identity primary key,
  invoice_id   uuid not null references public.invoices (id) on delete restrict,
  referral_id  uuid references public.referrals (id) on delete restrict,
  description  text not null,
  base_cents   int,                       -- valor da venda
  fee_bps      int,                       -- taxa aplicada (do plano vigente no dia do fechamento)
  amount_cents int not null check (amount_cents >= 0),
  active       boolean not null default true
);
create unique index if not exists uq_invoice_item_referral on public.invoice_items (referral_id) where referral_id is not null and active;

create table if not exists public.invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null unique references public.invoices (id) on delete restrict,
  amount_cents int  not null check (amount_cents >= 0),
  method       text not null check (method in ('pix', 'boleto', 'cartao', 'transferencia', 'outro')),
  gateway_ref  text,                      -- id da transação no banco/gateway
  paid_at      timestamptz not null default now(),
  recorded_by  uuid references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now()
);

create table if not exists public.receipts (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,
  invoice_id   uuid not null unique references public.invoices (id) on delete restrict,
  payment_id   uuid not null unique references public.invoice_payments (id) on delete restrict,
  company_id   uuid not null references public.companies (id) on delete restrict,
  amount_cents int  not null,
  issued_at    timestamptz not null default now(),
  payload      jsonb not null             -- retrato do recibo: quem pagou, quem recebeu, o quê, quanto, como
);
create index if not exists idx_receipts_company on public.receipts (company_id, issued_at desc);

-- Fatura: o valor e a identidade nunca mudam; o estado só anda para frente.
create or replace function public.invoice_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Fatura não pode ser apagada: cancele com motivo.' using errcode = 'restrict_violation';
  end if;
  if (to_jsonb(new) - 'status' - 'paid_at' - 'cancelled_at' - 'cancel_reason' - 'fiscal_note_number' - 'fiscal_note_url')
     is distinct from
     (to_jsonb(old) - 'status' - 'paid_at' - 'cancelled_at' - 'cancel_reason' - 'fiscal_note_number' - 'fiscal_note_url') then
    raise exception 'Valor e identificação da fatura não podem mudar.' using errcode = 'restrict_violation';
  end if;
  if old.status <> 'aberta' and new.status is distinct from old.status then
    raise exception 'Fatura % já está %: o estado não volta atrás.', old.number, old.status using errcode = 'restrict_violation';
  end if;
  if old.status = 'cancelada' then
    raise exception 'Fatura cancelada não pode mais ser alterada.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_invoice_guard on public.invoices;
create trigger trg_invoice_guard before update or delete on public.invoices
  for each row execute function public.invoice_guard();

-- Item só muda para "inativo" (quando a fatura é cancelada, a venda volta a poder ser cobrada).
create or replace function public.invoice_item_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Item de fatura não pode ser apagado.' using errcode = 'restrict_violation'; end if;
  if (to_jsonb(new) - 'active') is distinct from (to_jsonb(old) - 'active') or (new.active and not old.active) then
    raise exception 'Item de fatura só pode ser desativado.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_invoice_item_guard on public.invoice_items;
create trigger trg_invoice_item_guard before update or delete on public.invoice_items
  for each row execute function public.invoice_item_guard();

-- Cada venda fechada e a taxa devida (plano vigente no dia do fechamento). Uso interno.
create or replace view public.sale_fee_lines as
select r.id as referral_id, r.company_id, r.sale_value_cents, x.closed_at,
       coalesce(h.platform_fee_bps, c.platform_fee_bps) as fee_bps,
       round(r.sale_value_cents::numeric * coalesce(h.platform_fee_bps, c.platform_fee_bps) / 10000)::int as fee_cents,
       r.contract_number
  from public.referrals r
  join public.companies c on c.id = r.company_id
  cross join lateral (select coalesce((select min(sh.changed_at) from public.referral_stage_history sh
                                        where sh.referral_id = r.id and sh.to_stage = 'fechou'), r.stage_changed_at) as closed_at) x
  left join public.company_plan_history h
         on h.company_id = r.company_id and x.closed_at >= h.starts_at and (h.ends_at is null or x.closed_at < h.ends_at)
 where r.stage in ('fechou', 'instalada', 'paga') and r.sale_value_cents is not null;

-- Gera as faturas de um mês. p_allow_open_month: permite cobrar vendas de um mês ainda não encerrado.
create or replace function public.generate_invoices(p_month date, p_allow_open_month boolean default false, p_actor uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare v_month date := date_trunc('month', p_month)::date; v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
        v_due int; c record; v_plan text; v_price int; v_total int; v_inv uuid; n int := 0;
begin
  select coalesce(nullif(value, '')::int, 10) into v_due from public.platform_settings where key = 'invoice_due_days';
  v_due := coalesce(v_due, 10);
  for c in select id, name from public.companies where archived_at is null and status = 'ativa' loop
    -- mensalidade do plano
    select h.plan_code, p.monthly_price_cents into v_plan, v_price
      from public.company_plan_history h join public.plans p on p.code = h.plan_code
     where h.company_id = c.id and h.starts_at < v_next and (h.ends_at is null or h.ends_at >= v_month)
     order by h.starts_at desc limit 1;
    if v_price is not null and v_price > 0
       and not exists (select 1 from public.invoices where company_id = c.id and kind = 'mensalidade' and period_month = v_month and status <> 'cancelada') then
      insert into public.invoices (number, company_id, kind, period_month, plan_code, description, amount_cents, due_date, created_by)
      values (public.next_doc_number('invoice', 'F'), c.id, 'mensalidade', v_month, v_plan,
              'Mensalidade do plano ' || (select name from public.plans where code = v_plan) || ' — ' || to_char(v_month, 'MM/YYYY'),
              v_price, current_date + v_due, p_actor);
      n := n + 1;
    end if;
    -- taxa sobre vendas fechadas no mês (só depois de o mês acabar, salvo pedido explícito)
    if (p_allow_open_month or v_next <= current_date)
       and not exists (select 1 from public.invoices where company_id = c.id and kind = 'taxa_vendas' and period_month = v_month and status <> 'cancelada') then
      select coalesce(sum(l.fee_cents), 0) into v_total
        from public.sale_fee_lines l
       where l.company_id = c.id and l.closed_at >= v_month and l.closed_at < v_next
         and not exists (select 1 from public.invoice_items i where i.referral_id = l.referral_id and i.active);
      if v_total > 0 then
        insert into public.invoices (number, company_id, kind, period_month, description, amount_cents, due_date, created_by)
        values (public.next_doc_number('invoice', 'F'), c.id, 'taxa_vendas', v_month,
                'Taxa sobre vendas por indicação — ' || to_char(v_month, 'MM/YYYY'), v_total, current_date + v_due, p_actor)
        returning id into v_inv;
        insert into public.invoice_items (invoice_id, referral_id, description, base_cents, fee_bps, amount_cents)
        select v_inv, l.referral_id, 'Venda — contrato ' || coalesce(l.contract_number, 's/n'), l.sale_value_cents, l.fee_bps, l.fee_cents
          from public.sale_fee_lines l
         where l.company_id = c.id and l.closed_at >= v_month and l.closed_at < v_next
           and not exists (select 1 from public.invoice_items i where i.referral_id = l.referral_id and i.active and i.invoice_id <> v_inv);
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.admin_generate_invoices(p_month date) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  return public.generate_invoices(p_month, false, auth.uid());
end $$;

-- Confirma o pagamento (manual ou vindo do banco/gateway) e emite o recibo na hora.
create or replace function public.admin_record_payment(p_invoice uuid, p_method text, p_gateway_ref text default null, p_paid_at timestamptz default null)
returns text language plpgsql security definer set search_path = '' as $$
declare inv public.invoices; co public.companies; v_pay uuid; v_num text; v_paid timestamptz := coalesce(p_paid_at, now());
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  select * into inv from public.invoices where id = p_invoice for update;
  if not found then raise exception 'Fatura não encontrada.'; end if;
  if inv.status <> 'aberta' then raise exception 'Fatura % está %.', inv.number, inv.status; end if;
  if v_paid > now() + interval '1 minute' then raise exception 'Data de pagamento no futuro.'; end if;
  select * into co from public.companies where id = inv.company_id;
  insert into public.invoice_payments (invoice_id, amount_cents, method, gateway_ref, paid_at, recorded_by)
  values (inv.id, inv.amount_cents, p_method, p_gateway_ref, v_paid, auth.uid()) returning id into v_pay;
  update public.invoices set status = 'paga', paid_at = v_paid where id = inv.id;
  v_num := public.next_doc_number('receipt', 'R');
  insert into public.receipts (number, invoice_id, payment_id, company_id, amount_cents, issued_at, payload)
  values (v_num, inv.id, v_pay, inv.company_id, inv.amount_cents, now(), jsonb_build_object(
    'recebedor', jsonb_build_object('nome', (select value from public.platform_settings where key = 'issuer_legal_name'),
                                    'cnpj', (select value from public.platform_settings where key = 'issuer_cnpj')),
    'pagador',   jsonb_build_object('nome', coalesce(co.legal_name, co.name), 'cnpj', co.cnpj),
    'referente_a', inv.description, 'fatura', inv.number, 'valor_cents', inv.amount_cents,
    'forma_de_pagamento', p_method, 'pago_em', v_paid, 'referencia', p_gateway_ref,
    'aviso', 'Recibo de pagamento. Não substitui a nota fiscal de serviço.'));
  return v_num;
end $$;

create or replace function public.admin_cancel_invoice(p_invoice uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then raise exception 'Informe o motivo do cancelamento.'; end if;
  update public.invoices set status = 'cancelada', cancelled_at = now(), cancel_reason = btrim(p_reason)
   where id = p_invoice and status = 'aberta';
  if not found then raise exception 'Só é possível cancelar fatura em aberto.'; end if;
  update public.invoice_items set active = false where invoice_id = p_invoice;
end $$;

create or replace function public.admin_set_fiscal_note(p_invoice uuid, p_number text, p_url text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  if p_number is null or length(btrim(p_number)) = 0 then raise exception 'Informe o número da nota fiscal.'; end if;
  update public.invoices set fiscal_note_number = btrim(p_number), fiscal_note_url = p_url
   where id = p_invoice and status <> 'cancelada';
  if not found then raise exception 'Fatura não encontrada ou cancelada.'; end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) DADOS FISCAIS DO INDICADOR E REGRAS DE RETENÇÃO
-- ---------------------------------------------------------------------
create or replace function public.is_valid_cpf(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; i int; dv1 int; dv2 int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  dv1 := (s * 10) % 11; if dv1 = 10 then dv1 := 0; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  dv2 := (s * 10) % 11; if dv2 = 10 then dv2 := 0; end if;
  return dv1 = substr(d, 10, 1)::int and dv2 = substr(d, 11, 1)::int;
end $$;

create table if not exists public.indicator_tax_profiles (
  user_id     uuid primary key references public.profiles (id) on delete restrict,
  cpf         text not null unique check (cpf ~ '^\d{11}$'),
  legal_name  text not null check (length(btrim(legal_name)) > 0),
  address     text,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create or replace function public.indicator_save_tax_profile(p_cpf text, p_legal_name text, p_address text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Entre para continuar.' using errcode = 'insufficient_privilege'; end if;
  if not public.is_valid_cpf(v_cpf) then raise exception 'CPF inválido.'; end if;
  insert into public.indicator_tax_profiles (user_id, cpf, legal_name, address)
  values (auth.uid(), v_cpf, btrim(p_legal_name), nullif(btrim(coalesce(p_address, '')), ''))
  on conflict (user_id) do update set cpf = excluded.cpf, legal_name = excluded.legal_name, address = excluded.address, updated_at = now();
end $$;

-- Regras de retenção por parâmetro. Nascem DESATIVADAS e em zero: o contador define.
-- (O imposto real usa tabela progressiva mensal e limites; "taxa fixa" é um ponto de partida configurável.)
create table if not exists public.tax_rules (
  code            text primary key check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  kind            text not null check (kind in ('irrf', 'inss', 'outro')),
  description     text not null,
  rate_bps        int  not null default 0 check (rate_bps between 0 and 10000),
  min_base_cents  int  not null default 0 check (min_base_cents >= 0),   -- abaixo disso não retém
  active          boolean not null default false,
  notes           text,
  updated_at      timestamptz not null default now()
);
insert into public.tax_rules (code, kind, description, notes) values
  ('irrf_comissao', 'irrf', 'Imposto de renda retido na fonte sobre a comissão paga ao indicador (pessoa física).', 'Definir com o contador: tabela progressiva, base e isenções.'),
  ('inss_comissao', 'inss', 'Contribuição previdenciária retida do indicador (contribuinte individual).',            'Definir com o contador: alíquota, teto e se se aplica ao caso.')
on conflict (code) do nothing;

create or replace function public.admin_save_tax_rule(p_code text, p_rate_bps int, p_min_base_cents int, p_active boolean, p_notes text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  update public.tax_rules set rate_bps = p_rate_bps, min_base_cents = p_min_base_cents, active = p_active,
         notes = coalesce(p_notes, notes) where code = p_code;
  if not found then raise exception 'Regra inexistente.'; end if;
end $$;

-- Calcula as retenções de um pagamento com as regras ativas.
create or replace function public.compute_withholding(p_gross_cents int)
returns table (irrf_cents int, inss_cents int, other_cents int, snapshot jsonb)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when kind = 'irrf'  then round(p_gross_cents::numeric * rate_bps / 10000) end), 0)::int,
         coalesce(sum(case when kind = 'inss'  then round(p_gross_cents::numeric * rate_bps / 10000) end), 0)::int,
         coalesce(sum(case when kind = 'outro' then round(p_gross_cents::numeric * rate_bps / 10000) end), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object('code', code, 'kind', kind, 'rate_bps', rate_bps)), '[]'::jsonb)
    from public.tax_rules where active and p_gross_cents >= min_base_cents
$$;

-- ---------------------------------------------------------------------
-- 3) REGISTRO DE CADA PAGAMENTO DE COMISSÃO (bruto, retenções, líquido)
-- ---------------------------------------------------------------------
create table if not exists public.commission_payments (
  id            uuid primary key default gen_random_uuid(),
  commission_id uuid not null unique references public.commissions (id) on delete restrict,
  user_id       uuid references public.profiles (id) on delete restrict,   -- vazio só se o indicador nunca criou login
  company_id    uuid not null references public.companies (id) on delete restrict,
  batch_id      uuid references public.payout_batches (id) on delete restrict,
  month_ref     date not null,
  gross_cents   int  not null check (gross_cents >= 0),
  irrf_cents    int  not null default 0 check (irrf_cents >= 0),
  inss_cents    int  not null default 0 check (inss_cents >= 0),
  other_cents   int  not null default 0 check (other_cents >= 0),
  net_cents     int  not null check (net_cents >= 0),
  tax_snapshot  jsonb not null default '[]'::jsonb,
  paid_at       timestamptz not null default now(),
  check (net_cents = gross_cents - irrf_cents - inss_cents - other_cents)
);
create index if not exists idx_comm_pay_user on public.commission_payments (user_id, month_ref);

create or replace function public.register_commission_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_month date; w record; v_req text;
begin
  if new.status = 'paga' and old.status is distinct from 'paga' then
    select l.user_id into v_user from public.referrer_links l where l.id = new.link_id;
    select b.month_ref into v_month from public.payout_batches b where b.id = new.batch_id;
    select value into v_req from public.platform_settings where key = 'require_cpf_for_payout';
    if coalesce(v_req, 'false') = 'true' and not exists (select 1 from public.indicator_tax_profiles t where t.user_id = v_user) then
      raise exception 'Indicador sem CPF cadastrado: pagamento bloqueado (comissão %).', new.id using errcode = 'check_violation';
    end if;
    select * into w from public.compute_withholding(new.amount_cents);
    insert into public.commission_payments (commission_id, user_id, company_id, batch_id, month_ref, gross_cents,
                                            irrf_cents, inss_cents, other_cents, net_cents, tax_snapshot, paid_at)
    values (new.id, v_user, new.company_id, new.batch_id, coalesce(v_month, date_trunc('month', now())::date), new.amount_cents,
            w.irrf_cents, w.inss_cents, w.other_cents, new.amount_cents - w.irrf_cents - w.inss_cents - w.other_cents,
            w.snapshot, coalesce(new.paid_at, now()))
    on conflict (commission_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_register_commission_payment on public.commissions;
create trigger trg_register_commission_payment after update of status on public.commissions
  for each row execute function public.register_commission_payment();

-- Comissões já pagas antes desta migração entram no registro (sem retenção).
insert into public.commission_payments (commission_id, user_id, company_id, batch_id, month_ref, gross_cents, net_cents, paid_at)
select c.id, l.user_id, c.company_id, c.batch_id, coalesce(b.month_ref, date_trunc('month', c.paid_at)::date), c.amount_cents, c.amount_cents, coalesce(c.paid_at, now())
  from public.commissions c
  join public.referrer_links l on l.id = c.link_id
  left join public.payout_batches b on b.id = c.batch_id
 where c.status in ('paga', 'confirmada', 'contestada') and c.paid_at is not null
on conflict (commission_id) do nothing;

-- ---------------------------------------------------------------------
-- 4) INFORME DE RENDIMENTOS (por indicador, por ano) — versionado
-- ---------------------------------------------------------------------
create table if not exists public.income_statements (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,
  year           int  not null check (year between 2020 and 2100),
  user_id        uuid not null references public.profiles (id) on delete restrict,
  version        int  not null default 1,
  gross_cents    bigint not null,
  irrf_cents     bigint not null,
  inss_cents     bigint not null,
  other_cents    bigint not null,
  net_cents      bigint not null,
  payments_count int  not null,
  beneficiary_cpf        text,           -- retrato do momento da emissão
  beneficiary_name       text not null,
  payer_name             text,
  payer_cnpj             text,
  generated_at   timestamptz not null default now(),
  generated_by   uuid references public.profiles (id) on delete restrict,
  unique (year, user_id, version)
);

create or replace function public.generate_income_statements(p_year int, p_actor uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare u record; prev record; n int := 0; v_payer text; v_cnpj text; v_year_start date := make_date(p_year, 1, 1);
begin
  select value into v_payer from public.platform_settings where key = 'issuer_legal_name';
  select value into v_cnpj  from public.platform_settings where key = 'issuer_cnpj';
  for u in
    select p.user_id, sum(p.gross_cents)::bigint g, sum(p.irrf_cents)::bigint i, sum(p.inss_cents)::bigint s,
           sum(p.other_cents)::bigint o, sum(p.net_cents)::bigint nn, count(*)::int c
      from public.commission_payments p
     where p.user_id is not null and p.month_ref >= v_year_start and p.month_ref < v_year_start + interval '1 year'
     group by p.user_id
  loop
    select s.version, s.gross_cents, s.irrf_cents, s.inss_cents, s.other_cents, s.beneficiary_cpf into prev
      from public.income_statements s where s.year = p_year and s.user_id = u.user_id order by s.version desc limit 1;
    if not found
       or prev.gross_cents <> u.g or prev.irrf_cents <> u.i or prev.inss_cents <> u.s or prev.other_cents <> u.o
       or prev.beneficiary_cpf is distinct from (select t.cpf from public.indicator_tax_profiles t where t.user_id = u.user_id) then
      insert into public.income_statements (number, year, user_id, version, gross_cents, irrf_cents, inss_cents, other_cents, net_cents,
                                            payments_count, beneficiary_cpf, beneficiary_name, payer_name, payer_cnpj, generated_by)
      values (public.next_doc_number('income_statement', 'IR'), p_year, u.user_id, coalesce(prev.version, 0) + 1,
              u.g, u.i, u.s, u.o, u.nn, u.c,
              (select t.cpf from public.indicator_tax_profiles t where t.user_id = u.user_id),
              coalesce((select t.legal_name from public.indicator_tax_profiles t where t.user_id = u.user_id),
                       (select pr.full_name from public.profiles pr where pr.id = u.user_id)),
              nullif(v_payer, ''), nullif(v_cnpj, ''), p_actor);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.admin_generate_income_statements(p_year int) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  return public.generate_income_statements(p_year, auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- 5) Telas: o que cada papel enxerga
-- ---------------------------------------------------------------------
-- Faturas da empresa (a empresa vê as suas; admin vê todas).
create or replace view public.company_invoices as
select i.id, i.company_id, c.name as company_name, i.number, i.kind, i.period_month, i.description, i.amount_cents,
       case when i.status = 'aberta' and i.due_date < current_date then 'vencida' else i.status end as status,
       i.due_date, i.paid_at, i.fiscal_note_number, i.fiscal_note_url, r.number as receipt_number
  from public.invoices i
  join public.companies c on c.id = i.company_id
  left join public.receipts r on r.invoice_id = i.id
 where public.is_company_member(i.company_id) or public.is_platform_admin();

create or replace view public.company_receipts as
select r.id, r.company_id, r.number, r.amount_cents, r.issued_at, r.payload
  from public.receipts r
 where public.is_company_member(r.company_id) or public.is_platform_admin();

-- Detalhe da taxa sobre vendas (quais vendas compõem a fatura).
create or replace view public.company_invoice_items as
select it.invoice_id, it.description, it.base_cents, it.fee_bps, it.amount_cents, it.active
  from public.invoice_items it join public.invoices i on i.id = it.invoice_id
 where public.is_company_member(i.company_id) or public.is_platform_admin();

-- Quanto a empresa pagou ao Indiki+ em cada ano (comprovação para a contabilidade dela).
create or replace view public.company_annual_payments as
select r.company_id, extract(year from r.issued_at)::int as year, count(*)::int as receipts, sum(r.amount_cents)::bigint as paid_cents
  from public.receipts r
 where public.is_company_member(r.company_id) or public.is_platform_admin()
 group by r.company_id, extract(year from r.issued_at);

-- Painel do administrador: situação da cobrança por mês.
create or replace view public.admin_billing_overview as
select i.period_month,
       count(*)::int as invoices,
       coalesce(sum(i.amount_cents) filter (where i.status <> 'cancelada'), 0)::bigint as issued_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'paga'), 0)::bigint as received_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'aberta' and i.due_date >= current_date), 0)::bigint as open_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'aberta' and i.due_date < current_date), 0)::bigint as overdue_cents
  from public.invoices i
 where public.is_platform_admin()
 group by i.period_month;

-- Indicador: o que recebeu, com retenções (base do informe).
create or replace view public.indicator_payments as
select p.id, p.month_ref, p.paid_at, co.name as company_name, p.gross_cents, p.irrf_cents, p.inss_cents, p.other_cents, p.net_cents
  from public.commission_payments p join public.companies co on co.id = p.company_id
 where p.user_id = auth.uid();

create or replace view public.indicator_income_statements as
select s.id, s.number, s.year, s.version, s.gross_cents, s.irrf_cents, s.inss_cents, s.other_cents, s.net_cents,
       s.payments_count, s.beneficiary_cpf, s.beneficiary_name, s.payer_name, s.payer_cnpj, s.generated_at,
       (s.version = max(s.version) over (partition by s.year, s.user_id)) as is_latest
  from public.income_statements s
 where s.user_id = auth.uid();

-- Admin: quem recebeu comissão mas ainda não tem CPF (não dá para emitir informe completo).
create or replace view public.admin_tax_pending as
select p.user_id, pr.full_name, count(*)::int as payments, sum(p.gross_cents)::bigint as gross_cents
  from public.commission_payments p
  left join public.profiles pr on pr.id = p.user_id
 where public.is_platform_admin()
   and (p.user_id is null or not exists (select 1 from public.indicator_tax_profiles t where t.user_id = p.user_id))
 group by p.user_id, pr.full_name;

-- ---------------------------------------------------------------------
-- 6) Proteções, RLS e permissões
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['invoices','invoice_items','invoice_payments','receipts','indicator_tax_profiles','tax_rules',
                           'commission_payments','income_statements'] loop
    execute format('drop trigger if exists trg_no_delete on public.%I', t);
    execute format('create trigger trg_no_delete before delete on public.%I for each row execute function public.forbid_delete()', t);
  end loop;
  foreach t in array array['invoice_payments','receipts','commission_payments','income_statements'] loop
    execute format('drop trigger if exists trg_append_only on public.%I', t);
    execute format('create trigger trg_append_only before update or delete on public.%I for each row execute function public.forbid_change()', t);
  end loop;
  foreach t in array array['indicator_tax_profiles','tax_rules'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['invoices','invoice_payments','receipts','indicator_tax_profiles','tax_rules','commission_payments','income_statements'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

alter table public.invoices               enable row level security;
alter table public.invoice_items          enable row level security;
alter table public.invoice_payments       enable row level security;
alter table public.receipts               enable row level security;
alter table public.indicator_tax_profiles enable row level security;
alter table public.tax_rules              enable row level security;
alter table public.commission_payments    enable row level security;
alter table public.income_statements      enable row level security;

drop policy if exists p_inv_read      on public.invoices;
drop policy if exists p_invitem_read  on public.invoice_items;
drop policy if exists p_invpay_read   on public.invoice_payments;
drop policy if exists p_rcpt_read     on public.receipts;
drop policy if exists p_taxprof_read  on public.indicator_tax_profiles;
drop policy if exists p_taxrule_read  on public.tax_rules;
drop policy if exists p_cpay_read     on public.commission_payments;
drop policy if exists p_incst_read    on public.income_statements;
create policy p_inv_read     on public.invoices         for select to authenticated using (public.is_company_member(company_id) or public.is_platform_admin());
create policy p_invitem_read on public.invoice_items    for select to authenticated using (public.is_platform_admin() or exists (select 1 from public.invoices i where i.id = invoice_id and public.is_company_member(i.company_id)));
create policy p_invpay_read  on public.invoice_payments for select to authenticated using (public.is_platform_admin() or exists (select 1 from public.invoices i where i.id = invoice_id and public.is_company_member(i.company_id)));
create policy p_rcpt_read    on public.receipts         for select to authenticated using (public.is_company_member(company_id) or public.is_platform_admin());
create policy p_taxprof_read on public.indicator_tax_profiles for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy p_taxrule_read on public.tax_rules        for select to authenticated using (public.is_platform_admin());
create policy p_cpay_read    on public.commission_payments for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy p_incst_read   on public.income_statements for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

revoke all on public.invoices, public.invoice_items, public.invoice_payments, public.receipts, public.indicator_tax_profiles,
              public.tax_rules, public.commission_payments, public.income_statements from anon, authenticated;
grant select on public.invoices, public.invoice_items, public.invoice_payments, public.receipts, public.indicator_tax_profiles,
                public.tax_rules, public.commission_payments, public.income_statements to authenticated;
revoke all on public.sale_fee_lines from anon, authenticated;
grant select on public.company_invoices, public.company_receipts, public.company_invoice_items, public.company_annual_payments,
                public.admin_billing_overview, public.indicator_payments, public.indicator_income_statements,
                public.admin_tax_pending to authenticated;

revoke all on function
  public.next_doc_number(text, text), public.invoice_guard(), public.invoice_item_guard(), public.generate_invoices(date, boolean, uuid),
  public.admin_generate_invoices(date), public.admin_record_payment(uuid, text, text, timestamptz), public.admin_cancel_invoice(uuid, text),
  public.admin_set_fiscal_note(uuid, text, text), public.is_valid_cpf(text), public.indicator_save_tax_profile(text, text, text),
  public.admin_save_tax_rule(text, int, int, boolean, text), public.compute_withholding(int), public.register_commission_payment(),
  public.generate_income_statements(int, uuid), public.admin_generate_income_statements(int)
  from public, anon, authenticated;
grant execute on function
  public.admin_generate_invoices(date), public.admin_record_payment(uuid, text, text, timestamptz), public.admin_cancel_invoice(uuid, text),
  public.admin_set_fiscal_note(uuid, text, text), public.indicator_save_tax_profile(text, text, text),
  public.admin_save_tax_rule(text, int, int, boolean, text), public.admin_generate_income_statements(int) to authenticated;
grant execute on function public.is_valid_cpf(text) to authenticated;
