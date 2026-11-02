-- =====================================================================
-- Indiki+ — Planos (o que a empresa paga) e Selos (o que a empresa conquista)
-- Tudo parametrizado em tabelas: valores, limites e regras mudam por dados,
-- sem mexer em código. Cada item pode ser ativado/desativado.
--   PLANOS:  inicial, intermediario, avancado, avancado_mais
--   SELOS:   bronze, prata, ouro, platina, diamante (por pontuação de mérito)
-- Regras de segurança do restante do banco continuam valendo:
--   nada é apagado; quem escreve é função (RPC); histórico só cresce.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PLANOS
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  code                 text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name                 text not null check (length(btrim(name)) > 0),
  description          text,
  sort_order           int  not null default 0,
  active               boolean not null default true,        -- desativado = não pode ser contratado de novo
  monthly_price_cents  int check (monthly_price_cents is null or monthly_price_cents >= 0), -- null = a definir
  platform_fee_bps     int  not null check (platform_fee_bps between 0 and 10000),          -- 100 = 1%
  max_active_referrers int check (max_active_referrers is null or max_active_referrers > 0), -- null = ilimitado
  max_offers           int check (max_offers is null or max_offers > 0),
  max_members          int check (max_members is null or max_members > 0),
  report_level         text not null default 'basico'  check (report_level in ('basico', 'mensal', 'completo')),
  crm_integration      boolean not null default false,
  marketplace_highlight boolean not null default false,
  support_level        text not null default 'email'   check (support_level in ('email', 'whatsapp', 'prioritario')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

insert into public.plans
  (code, name, description, sort_order, platform_fee_bps, max_active_referrers, max_offers, max_members,
   report_level, crm_integration, marketplace_highlight, support_level)
values
  ('inicial',       'Inicial',       'Para começar a indicar com poucos clientes.',          1, 100,   10,    3,    1, 'basico',   false, false, 'email'),
  ('intermediario', 'Intermediário', 'Mais indicadores e relatório mensal em planilha.',     2,  80,   50,   10,    2, 'mensal',   false, false, 'email'),
  ('avancado',      'Avançado',      'Integração com o CRM e equipe maior.',                 3,  60,  200, null,    5, 'completo', true,  false, 'whatsapp'),
  ('avancado_mais', 'Avançado+',     'Sem limites, destaque na vitrine e suporte prioritário.', 4, 50, null, null, null, 'completo', true,  true,  'prioritario')
on conflict (code) do nothing;

-- Histórico de qual plano a empresa teve e quando (a taxa fica registrada no momento).
create table if not exists public.company_plan_history (
  id               bigint generated always as identity primary key,
  company_id       uuid not null references public.companies (id) on delete restrict,
  plan_code        text not null references public.plans (code) on delete restrict,
  platform_fee_bps int  not null check (platform_fee_bps between 0 and 10000),
  starts_at        timestamptz not null default now(),
  ends_at          timestamptz,
  set_by           uuid references public.profiles (id) on delete restrict,
  note             text,
  check (ends_at is null or ends_at >= starts_at)
);
create unique index if not exists uq_company_plan_current on public.company_plan_history (company_id) where ends_at is null;
create index if not exists idx_company_plan_hist on public.company_plan_history (company_id, starts_at);

-- Empresas já existentes entram no plano Inicial desde a criação, com a taxa que já tinham.
insert into public.company_plan_history (company_id, plan_code, platform_fee_bps, starts_at, note)
select c.id, 'inicial', c.platform_fee_bps, c.created_at, 'Plano inicial automático'
  from public.companies c
 where not exists (select 1 from public.company_plan_history h where h.company_id = c.id);

-- Plano atual da empresa.
create or replace function public.company_plan_code(p_company uuid) returns text
language sql stable security definer set search_path = '' as $$
  select plan_code from public.company_plan_history where company_id = p_company and ends_at is null
$$;

-- Toda empresa nova nasce no plano Inicial.
create or replace function public.assign_initial_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_fee int;
begin
  select platform_fee_bps into v_fee from public.plans where code = 'inicial';
  insert into public.company_plan_history (company_id, plan_code, platform_fee_bps, note)
  values (new.id, 'inicial', coalesce(v_fee, new.platform_fee_bps), 'Plano inicial automático');
  return new;
end $$;
drop trigger if exists trg_assign_initial_plan on public.companies;
create trigger trg_assign_initial_plan after insert on public.companies
  for each row execute function public.assign_initial_plan();

-- Histórico: só o fim do período pode mudar, uma vez.
create or replace function public.plan_history_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Histórico de planos não pode ser apagado.' using errcode = 'restrict_violation';
  end if;
  if old.ends_at is not null
     or (to_jsonb(new) - 'ends_at') is distinct from (to_jsonb(old) - 'ends_at') then
    raise exception 'Histórico de planos só aceita o fechamento do período.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_plan_history_guard on public.company_plan_history;
create trigger trg_plan_history_guard before update or delete on public.company_plan_history
  for each row execute function public.plan_history_guard();

-- Limites do plano, travados no banco (não dá para burlar pela tela).
create or replace function public.enforce_plan_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_limit int; v_used int; v_label text; v_company uuid;
begin
  v_company := new.company_id;
  if tg_table_name = 'referrer_links' then
    if not new.active or new.archived_at is not null then return new; end if;
    if tg_op = 'UPDATE' and old.active and old.archived_at is null then return new; end if;
    select p.max_active_referrers into v_limit from public.plans p where p.code = public.company_plan_code(v_company);
    select count(*) into v_used from public.referrer_links where company_id = v_company and active and archived_at is null and id <> new.id;
    v_label := 'indicadores ativos';
  elsif tg_table_name = 'offers' then
    if not new.active or new.archived_at is not null then return new; end if;
    if tg_op = 'UPDATE' and old.active and old.archived_at is null then return new; end if;
    select p.max_offers into v_limit from public.plans p where p.code = public.company_plan_code(v_company);
    select count(*) into v_used from public.offers where company_id = v_company and active and archived_at is null and id <> new.id;
    v_label := 'produtos';
  else -- company_members
    select p.max_members into v_limit from public.plans p where p.code = public.company_plan_code(v_company);
    select count(*) into v_used from public.company_members where company_id = v_company;
    v_label := 'usuários da empresa';
  end if;
  if v_limit is not null and v_used >= v_limit then
    raise exception 'Limite do plano atingido: % (máximo %). Mude de plano para continuar.', v_label, v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_links on public.referrer_links;
create trigger trg_limit_links before insert or update of active, archived_at on public.referrer_links
  for each row execute function public.enforce_plan_limit();
drop trigger if exists trg_limit_offers on public.offers;
create trigger trg_limit_offers before insert or update of active, archived_at on public.offers
  for each row execute function public.enforce_plan_limit();
drop trigger if exists trg_limit_members on public.company_members;
create trigger trg_limit_members before insert on public.company_members
  for each row execute function public.enforce_plan_limit();

-- ---------------------------------------------------------------------
-- 2) SELOS
-- ---------------------------------------------------------------------
-- Critérios: o que conta pontos, quanto vale cada unidade e o teto de pontos.
create table if not exists public.seal_criteria (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name        text not null,
  description text,
  weight      int  not null,                       -- pontos por unidade (negativo = desconta)
  max_points  int  check (max_points is null or max_points > 0),  -- teto de pontos deste critério
  active      boolean not null default true,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);
-- Os critérios com medição pronta no banco estão listados na função company_seal_metrics.
insert into public.seal_criteria (code, name, description, weight, max_points, active, sort_order) values
  ('closed_sales',           'Vendas fechadas',               'Vendas por indicação com número de contrato registrado.',       10, null, true,  1),
  ('confirmed_commissions',  'Indicadores que confirmaram',   'Comissões que o indicador confirmou ter recebido corretamente.', 15, null, true,  2),
  ('disputes',               'Contestações',                  'Comissões contestadas pelo indicador (desconta pontos).',        -25, null, true,  3),
  ('months_active',          'Tempo de casa',                 'Meses desde o cadastro da empresa.',                              5,   60, true,  4),
  ('fee_on_time',            'Taxa do Indiki+ paga em dia',   'Ainda sem medição no banco; fica desativado até existir cobrança.', 10, null, false, 5)
on conflict (code) do nothing;

-- Níveis do selo: pontuação mínima e mínimo de vendas para chegar em cada um.
create table if not exists public.seal_levels (
  code             text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name             text not null,
  sort_order       int  not null unique,           -- maior = mais alto
  min_points       int  not null default 0 check (min_points >= 0),
  min_closed_sales int  not null default 0 check (min_closed_sales >= 0),
  active           boolean not null default true,  -- desativado = nível pulado
  updated_at       timestamptz not null default now()
);
insert into public.seal_levels (code, name, sort_order, min_points, min_closed_sales) values
  ('bronze',   'Bronze',     1,    0,   0),
  ('prata',    'Prata',      2,  100,   5),
  ('ouro',     'Ouro',       3,  300,  20),
  ('platina',  'Platina',    4,  700,  50),
  ('diamante', 'Diamante',   5, 1500, 120)
on conflict (code) do nothing;

-- Medição bruta por critério.
create or replace function public.company_seal_metrics(p_company uuid) returns table (criterion text, raw_value int)
language sql stable security definer set search_path = '' as $$
  select 'closed_sales', count(*)::int from public.referrals
   where company_id = p_company and stage in ('fechou', 'instalada', 'paga') and contract_number is not null
  union all
  select 'confirmed_commissions', count(*)::int from public.commissions
   where company_id = p_company and confirmed_at is not null
  union all
  select 'disputes', count(*)::int from public.commissions
   where company_id = p_company and contested_at is not null
  union all
  select 'months_active',
         greatest(0, (extract(year from age(now(), c.created_at)) * 12 + extract(month from age(now(), c.created_at)))::int)
    from public.companies c where c.id = p_company
  union all
  select 'fee_on_time', 0
$$;

-- Pontuação e nível calculados com os parâmetros ATIVOS.
create or replace function public.company_seal_calc(p_company uuid)
returns table (score int, closed_sales int, level_code text, metrics jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v_score int; v_sales int; v_level text; v_metrics jsonb;
begin
  select coalesce(sum(least(m.raw_value * k.weight, coalesce(k.max_points, 2147483647))), 0)::int,
         coalesce(jsonb_object_agg(m.criterion, m.raw_value), '{}'::jsonb)
    into v_score, v_metrics
    from public.company_seal_metrics(p_company) m
    join public.seal_criteria k on k.code = m.criterion and k.active;
  v_score := greatest(v_score, 0);
  select raw_value into v_sales from public.company_seal_metrics(p_company) where criterion = 'closed_sales';
  select l.code into v_level
    from public.seal_levels l
   where l.active and v_score >= l.min_points and coalesce(v_sales, 0) >= l.min_closed_sales
     and exists (select 1 from public.companies c where c.id = p_company and c.status = 'ativa')
   order by l.sort_order desc limit 1;
  return query select v_score, coalesce(v_sales, 0), v_level, v_metrics;
end $$;

-- Registro do selo ao longo do tempo (só cresce).
create table if not exists public.company_seals (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.companies (id) on delete restrict,
  level_code   text references public.seal_levels (code) on delete restrict,
  score        int  not null,
  metrics      jsonb not null default '{}'::jsonb,
  level_since  timestamptz not null default now(),   -- desde quando está neste nível
  computed_at  timestamptz not null default now()
);
create index if not exists idx_company_seals on public.company_seals (company_id, id desc);

-- Recalcula o selo de todas as empresas (rodar todo dia ou depois de cada venda/confirmação).
create or replace function public.recalculate_seals() returns int
language plpgsql security definer set search_path = '' as $$
declare c record; r record; prev record; n int := 0;
begin
  for c in select id from public.companies where archived_at is null loop
    select * into r from public.company_seal_calc(c.id);
    select s.level_code, s.score, s.level_since into prev
      from public.company_seals s where s.company_id = c.id order by s.id desc limit 1;
    if not found or prev.level_code is distinct from r.level_code or prev.score <> r.score then
      insert into public.company_seals (company_id, level_code, score, metrics, level_since)
      values (c.id, r.level_code, r.score, r.metrics,
              case when found and prev.level_code is not distinct from r.level_code then prev.level_since else now() end);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 3) Proteções (mesmo padrão do resto do banco)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['plans', 'seal_criteria', 'seal_levels'] loop
    execute format('drop trigger if exists trg_no_delete on public.%I', t);
    execute format('create trigger trg_no_delete before delete on public.%I for each row execute function public.forbid_delete()', t);
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
  execute 'drop trigger if exists trg_append_only on public.company_seals';
  execute 'create trigger trg_append_only before update or delete on public.company_seals for each row execute function public.forbid_change()';
  foreach t in array array['plans', 'seal_criteria', 'seal_levels', 'company_plan_history'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- audit_row procura "id"; as tabelas de parâmetros usam "code". Ajuste para registrar o código também.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb; v_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'code', v_old ->> 'code',
                   concat_ws(':', v_new ->> 'company_id', v_new ->> 'user_id'));
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
  values (tg_table_name, v_id, tg_op, v_old, v_new, auth.uid());
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 4) Funções do administrador do Indiki+ (única porta de escrita)
-- ---------------------------------------------------------------------
create or replace function public.admin_save_plan(
  p_code text, p_name text, p_description text, p_sort_order int, p_price_cents int, p_fee_bps int,
  p_max_referrers int, p_max_offers int, p_max_members int, p_report_level text,
  p_crm boolean, p_highlight boolean, p_support text, p_active boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  insert into public.plans (code, name, description, sort_order, monthly_price_cents, platform_fee_bps,
        max_active_referrers, max_offers, max_members, report_level, crm_integration, marketplace_highlight, support_level, active)
  values (p_code, p_name, p_description, p_sort_order, p_price_cents, p_fee_bps,
        p_max_referrers, p_max_offers, p_max_members, p_report_level, p_crm, p_highlight, p_support, p_active)
  on conflict (code) do update set
        name = excluded.name, description = excluded.description, sort_order = excluded.sort_order,
        monthly_price_cents = excluded.monthly_price_cents, platform_fee_bps = excluded.platform_fee_bps,
        max_active_referrers = excluded.max_active_referrers, max_offers = excluded.max_offers,
        max_members = excluded.max_members, report_level = excluded.report_level,
        crm_integration = excluded.crm_integration, marketplace_highlight = excluded.marketplace_highlight,
        support_level = excluded.support_level, active = excluded.active;
end $$;

create or replace function public.admin_set_company_plan(p_company uuid, p_plan text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare pl public.plans; cur text; n int;
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  select * into pl from public.plans where code = p_plan;
  if not found then raise exception 'Plano inexistente.'; end if;
  if not pl.active then raise exception 'Este plano está desativado e não pode ser contratado.'; end if;
  cur := public.company_plan_code(p_company);
  if cur = p_plan then return; end if;
  -- Rebaixar só se a empresa já couber nos limites do novo plano.
  select count(*) into n from public.referrer_links where company_id = p_company and active and archived_at is null;
  if pl.max_active_referrers is not null and n > pl.max_active_referrers then
    raise exception 'A empresa tem % indicadores ativos e o plano permite %.', n, pl.max_active_referrers; end if;
  select count(*) into n from public.offers where company_id = p_company and active and archived_at is null;
  if pl.max_offers is not null and n > pl.max_offers then
    raise exception 'A empresa tem % produtos ativos e o plano permite %.', n, pl.max_offers; end if;
  select count(*) into n from public.company_members where company_id = p_company;
  if pl.max_members is not null and n > pl.max_members then
    raise exception 'A empresa tem % usuários e o plano permite %.', n, pl.max_members; end if;
  update public.company_plan_history set ends_at = now() where company_id = p_company and ends_at is null;
  insert into public.company_plan_history (company_id, plan_code, platform_fee_bps, set_by, note)
  values (p_company, p_plan, pl.platform_fee_bps, auth.uid(), p_note);
  update public.companies set platform_fee_bps = pl.platform_fee_bps where id = p_company;
end $$;

create or replace function public.admin_save_seal_level(
  p_code text, p_name text, p_sort_order int, p_min_points int, p_min_sales int, p_active boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  insert into public.seal_levels (code, name, sort_order, min_points, min_closed_sales, active)
  values (p_code, p_name, p_sort_order, p_min_points, p_min_sales, p_active)
  on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order,
        min_points = excluded.min_points, min_closed_sales = excluded.min_closed_sales, active = excluded.active;
end $$;

create or replace function public.admin_save_seal_criterion(
  p_code text, p_weight int, p_max_points int default null, p_active boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  update public.seal_criteria set weight = p_weight, max_points = p_max_points, active = p_active where code = p_code;
  if not found then raise exception 'Critério inexistente: só os critérios com medição pronta podem ser configurados.'; end if;
end $$;

create or replace function public.admin_recalculate_seals() returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  return public.recalculate_seals();
end $$;

-- ---------------------------------------------------------------------
-- 5) Taxa do Indiki+ usa a taxa do plano vigente NO DIA em que a venda fechou
--    (mudar de plano não altera o que já foi vendido).
-- ---------------------------------------------------------------------
create or replace view public.company_platform_fees as
with closed as (
  select r.company_id, r.sale_value_cents,
         coalesce((select min(h.changed_at) from public.referral_stage_history h
                    where h.referral_id = r.id and h.to_stage = 'fechou'), r.stage_changed_at) as closed_at
    from public.referrals r
   where r.stage in ('fechou', 'instalada', 'paga')
), priced as (
  select k.company_id, k.sale_value_cents,
         coalesce(h.platform_fee_bps, c.platform_fee_bps) as fee_bps
    from closed k
    join public.companies c on c.id = k.company_id
    left join public.company_plan_history h
           on h.company_id = k.company_id and k.closed_at >= h.starts_at and (h.ends_at is null or k.closed_at < h.ends_at)
)
select c.id as company_id, c.name, c.platform_fee_bps,
       coalesce(sum(p.sale_value_cents), 0)::bigint as sales_cents,
       coalesce(round(sum(p.sale_value_cents::numeric * p.fee_bps / 10000)), 0)::bigint as fee_cents
  from public.companies c
  left join priced p on p.company_id = c.id
 where public.is_company_member(c.id) or public.is_platform_admin()
 group by c.id;

-- ---------------------------------------------------------------------
-- 6) Telas: o que cada papel enxerga
-- ---------------------------------------------------------------------
-- Plano atual da empresa, com o uso de cada limite.
create or replace view public.company_current_plan as
select c.id as company_id, p.code as plan_code, p.name as plan_name, p.platform_fee_bps,
       p.max_active_referrers, p.max_offers, p.max_members,
       p.report_level, p.crm_integration, p.marketplace_highlight, p.support_level,
       (select count(*) from public.referrer_links l where l.company_id = c.id and l.active and l.archived_at is null) as used_referrers,
       (select count(*) from public.offers o where o.company_id = c.id and o.active and o.archived_at is null) as used_offers,
       (select count(*) from public.company_members m where m.company_id = c.id) as used_members
  from public.companies c
  join public.company_plan_history h on h.company_id = c.id and h.ends_at is null
  join public.plans p on p.code = h.plan_code
 where public.is_company_member(c.id) or public.is_platform_admin();

-- Selo atual (empresa vê o seu; admin vê todos).
create or replace view public.company_seal_current as
select distinct on (s.company_id) s.company_id, s.level_code, l.name as level_name, s.score, s.metrics, s.level_since, s.computed_at
  from public.company_seals s
  left join public.seal_levels l on l.code = s.level_code
 where public.is_company_member(s.company_id) or public.is_platform_admin()
 order by s.company_id, s.id desc;

-- Verificação pública do selo (sem login): só nome, nível e desde quando.
create or replace view public.public_company_seals as
select x.company_id, c.name as company_name, x.level_code, x.level_name, x.level_since
  from (
    select distinct on (s.company_id) s.company_id, s.level_code, l.name as level_name, s.level_since
      from public.company_seals s
      join public.seal_levels l on l.code = s.level_code
     order by s.company_id, s.id desc
  ) x
  join public.companies c on c.id = x.company_id and c.status = 'ativa' and c.archived_at is null;

alter table public.plans                 enable row level security;
alter table public.seal_criteria         enable row level security;
alter table public.seal_levels           enable row level security;
alter table public.company_plan_history  enable row level security;
alter table public.company_seals         enable row level security;

drop policy if exists p_plans_read    on public.plans;
drop policy if exists p_plans_anon    on public.plans;
drop policy if exists p_levels_anon   on public.seal_levels;
drop policy if exists p_criteria_read on public.seal_criteria;
drop policy if exists p_levels_read   on public.seal_levels;
drop policy if exists p_planhist_read on public.company_plan_history;
drop policy if exists p_seals_read    on public.company_seals;
create policy p_plans_anon    on public.plans         for select to anon using (active);
create policy p_plans_read    on public.plans         for select to authenticated using (active or public.is_platform_admin());
create policy p_criteria_read on public.seal_criteria for select to authenticated using (active or public.is_platform_admin());
create policy p_levels_anon   on public.seal_levels   for select to anon using (active);
create policy p_levels_read   on public.seal_levels   for select to authenticated using (active or public.is_platform_admin());
create policy p_planhist_read on public.company_plan_history for select to authenticated
  using (public.is_company_member(company_id) or public.is_platform_admin());
create policy p_seals_read    on public.company_seals for select to authenticated
  using (public.is_company_member(company_id) or public.is_platform_admin());

revoke all on public.plans, public.seal_criteria, public.seal_levels, public.company_plan_history, public.company_seals from anon, authenticated;
grant select on public.plans, public.seal_levels to anon, authenticated;
grant select on public.seal_criteria, public.company_plan_history, public.company_seals to authenticated;
grant select on public.company_current_plan, public.company_seal_current, public.company_platform_fees to authenticated;
grant select on public.public_company_seals to anon, authenticated;

revoke all on function public.company_plan_code(uuid), public.assign_initial_plan(), public.enforce_plan_limit(),
  public.plan_history_guard(), public.company_seal_metrics(uuid), public.company_seal_calc(uuid),
  public.recalculate_seals(),
  public.admin_save_plan(text, text, text, int, int, int, int, int, int, text, boolean, boolean, text, boolean),
  public.admin_set_company_plan(uuid, text, text),
  public.admin_save_seal_level(text, text, int, int, int, boolean),
  public.admin_save_seal_criterion(text, int, int, boolean),
  public.admin_recalculate_seals() from public, anon, authenticated;
grant execute on function
  public.admin_save_plan(text, text, text, int, int, int, int, int, int, text, boolean, boolean, text, boolean),
  public.admin_set_company_plan(uuid, text, text),
  public.admin_save_seal_level(text, text, int, int, int, boolean),
  public.admin_save_seal_criterion(text, int, int, boolean),
  public.admin_recalculate_seals() to authenticated;
