-- =====================================================================
-- Indiki+ — Grupos de cliente, certificados do selo e ranking de indicadores
-- Tudo por parâmetros (tabelas), com ativar/desativar. Escrita só por função.
--   GRUPOS:       em que perfil a empresa se encaixa -> sugere o plano
--   CERTIFICADOS: o selo conquistado vira um certificado verificável (código público)
--   RANKING:      indicadores sobem de nível por pontos e ganham benefícios
-- Nomes dos níveis do ranking são provisórios (Nível 1..5): trocar é só atualizar dados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Configurações gerais da plataforma (chave/valor, editadas só pelo admin)
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);
insert into public.platform_settings (key, value, description) values
  ('seal_certificate_validity_days', '365', 'Validade de um certificado de selo, em dias.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 1) GRUPOS DE CLIENTE
-- ---------------------------------------------------------------------
create table if not exists public.customer_groups (
  code                  text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name                  text not null check (length(btrim(name)) > 0),
  description           text,
  recommended_plan_code text references public.plans (code) on delete restrict,
  sort_order            int  not null default 0,
  active                boolean not null default true,
  updated_at            timestamptz not null default now()
);
insert into public.customer_groups (code, name, description, recommended_plan_code, sort_order) values
  ('autonomo', 'Profissional autônomo',  'Trabalha sozinho ou com pouca equipe, poucos clientes ativos.',  'inicial',       1),
  ('pequena',  'Pequena empresa',        'Equipe pequena e carteira de clientes em crescimento.',           'intermediario', 2),
  ('media',    'Média empresa',          'Vários vendedores, usa CRM e precisa de relatórios completos.',   'avancado',      3),
  ('grande',   'Grande empresa ou rede', 'Operação grande, várias unidades, sem limite de indicadores.',    'avancado_mais', 4)
on conflict (code) do nothing;

alter table public.companies add column if not exists customer_group text references public.customer_groups (code) on delete restrict;

create or replace function public.admin_save_customer_group(
  p_code text, p_name text, p_description text, p_plan text, p_sort_order int, p_active boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  insert into public.customer_groups (code, name, description, recommended_plan_code, sort_order, active)
  values (p_code, p_name, p_description, p_plan, p_sort_order, p_active)
  on conflict (code) do update set name = excluded.name, description = excluded.description,
        recommended_plan_code = excluded.recommended_plan_code, sort_order = excluded.sort_order, active = excluded.active;
end $$;

create or replace function public.admin_set_company_group(p_company uuid, p_group text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  if p_group is not null and not exists (select 1 from public.customer_groups where code = p_group and active) then
    raise exception 'Grupo inexistente ou desativado.'; end if;
  update public.companies set customer_group = p_group where id = p_company;
  if not found then raise exception 'Empresa não encontrada.'; end if;
end $$;

-- Empresa e admin: grupo, plano atual e plano sugerido.
create or replace view public.company_group_plan as
select c.id as company_id, c.name, g.code as group_code, g.name as group_name,
       g.recommended_plan_code, rp.name as recommended_plan_name,
       h.plan_code as current_plan_code, cp.name as current_plan_name,
       (g.recommended_plan_code is not null and g.recommended_plan_code is distinct from h.plan_code) as plan_differs
  from public.companies c
  left join public.customer_groups g on g.code = c.customer_group
  left join public.plans rp on rp.code = g.recommended_plan_code
  left join public.company_plan_history h on h.company_id = c.id and h.ends_at is null
  left join public.plans cp on cp.code = h.plan_code
 where public.is_company_member(c.id) or public.is_platform_admin();

-- ---------------------------------------------------------------------
-- 2) CERTIFICADOS DO SELO
-- ---------------------------------------------------------------------
create table if not exists public.seal_certificates (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete restrict,
  level_code        text not null references public.seal_levels (code) on delete restrict,
  verification_code text not null unique check (verification_code ~ '^IM-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  score             int  not null,
  issued_at         timestamptz not null default now(),
  valid_until       timestamptz not null,
  revoked_at        timestamptz,
  revoked_reason    text,
  issued_by         uuid references public.profiles (id) on delete restrict,   -- vazio = emitido automaticamente
  check (valid_until > issued_at),
  check ((revoked_at is null) = (revoked_reason is null))
);
create index if not exists idx_seal_cert_company on public.seal_certificates (company_id, issued_at desc);

-- Só a revogação pode ser gravada depois, uma vez.
create or replace function public.seal_certificate_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Certificado não pode ser apagado: revogue com motivo.' using errcode = 'restrict_violation';
  end if;
  if old.revoked_at is not null
     or (to_jsonb(new) - 'revoked_at' - 'revoked_reason') is distinct from (to_jsonb(old) - 'revoked_at' - 'revoked_reason') then
    raise exception 'Certificado emitido só aceita revogação.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_seal_certificate_guard on public.seal_certificates;
create trigger trg_seal_certificate_guard before update or delete on public.seal_certificates
  for each row execute function public.seal_certificate_guard();

create or replace function public.gen_certificate_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v text; i int;
begin
  loop
    v := 'IM-';
    for i in 1..4 loop v := v || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    v := v || '-';
    for i in 1..4 loop v := v || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.seal_certificates where verification_code = v);
  end loop;
  return v;
end $$;

-- Emite certificado para quem tem selo e ainda não tem um válido naquele nível; revoga os que não valem mais.
create or replace function public.issue_seal_certificates(p_actor uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare s record; n int := 0; v_days int;
begin
  select coalesce(nullif(value, '')::int, 365) into v_days from public.platform_settings where key = 'seal_certificate_validity_days';
  v_days := coalesce(v_days, 365);
  -- selo atual de cada empresa
  for s in
    select distinct on (cs.company_id) cs.company_id, cs.level_code, cs.score
      from public.company_seals cs order by cs.company_id, cs.id desc
  loop
    update public.seal_certificates
       set revoked_at = now(), revoked_reason = 'Nível do selo mudou'
     where company_id = s.company_id and revoked_at is null and level_code is distinct from s.level_code;
    if s.level_code is not null and not exists (
         select 1 from public.seal_certificates
          where company_id = s.company_id and level_code = s.level_code and revoked_at is null and valid_until > now()) then
      insert into public.seal_certificates (company_id, level_code, verification_code, score, valid_until, issued_by)
      values (s.company_id, s.level_code, public.gen_certificate_code(), s.score, now() + make_interval(days => v_days), p_actor);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- O recálculo dos selos passa a emitir/revogar os certificados também.
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
  perform public.issue_seal_certificates(auth.uid());
  return n;
end $$;

create or replace function public.admin_issue_certificates() returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  return public.issue_seal_certificates(auth.uid());
end $$;

create or replace function public.admin_revoke_certificate(p_certificate uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then raise exception 'Informe o motivo da revogação.'; end if;
  update public.seal_certificates set revoked_at = now(), revoked_reason = btrim(p_reason)
   where id = p_certificate and revoked_at is null;
  if not found then raise exception 'Certificado não encontrado ou já revogado.'; end if;
end $$;

-- Verificação pública (sem login). Quem tem o código confere; não dá para listar certificados.
create or replace function public.verify_certificate(p_code text)
returns table (status text, company_name text, level_name text, issued_at timestamptz, valid_until timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare k public.seal_certificates; cur text;
begin
  select * into k from public.seal_certificates where verification_code = upper(btrim(p_code));
  if not found then
    return query select 'inexistente'::text, null::text, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  select s.level_code into cur from public.company_seals s where s.company_id = k.company_id order by s.id desc limit 1;
  return query
    select case when k.revoked_at is not null then 'revogado'
                when k.valid_until <= now() then 'expirado'
                when cur is distinct from k.level_code then 'desatualizado'
                else 'valido' end,
           c.name, l.name, k.issued_at, k.valid_until
      from public.companies c, public.seal_levels l
     where c.id = k.company_id and l.code = k.level_code;
end $$;

create or replace view public.company_certificates as
select k.id, k.company_id, l.name as level_name, k.verification_code, k.score, k.issued_at, k.valid_until,
       k.revoked_at, k.revoked_reason,
       case when k.revoked_at is not null then 'revogado' when k.valid_until <= now() then 'expirado' else 'valido' end as status
  from public.seal_certificates k join public.seal_levels l on l.code = k.level_code
 where public.is_company_member(k.company_id) or public.is_platform_admin();

-- ---------------------------------------------------------------------
-- 3) RANKING DE INDICADORES
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists ranking_opt_in boolean not null default false;  -- aparecer com o nome no ranking

create table if not exists public.referrer_criteria (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name        text not null,
  description text,
  weight      int  not null,
  max_points  int  check (max_points is null or max_points > 0),
  active      boolean not null default true,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);
insert into public.referrer_criteria (code, name, description, weight, max_points, sort_order) values
  ('closed_referrals',      'Indicações fechadas',           'Indicações que viraram venda.',                          10, null, 1),
  ('confirmed_commissions', 'Comissões confirmadas',         'Comissões que o indicador confirmou ter recebido.',      15, null, 2),
  ('companies_count',       'Empresas em que já vendeu',     'Quantidade de empresas diferentes com ao menos 1 venda.', 20,  100, 3),
  ('months_active',         'Tempo de casa',                 'Meses desde o cadastro.',                                  3,   36, 4)
on conflict (code) do nothing;

create table if not exists public.referrer_tiers (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null,                                -- provisório: "Nível 1".."Nível 5"
  sort_order  int  not null unique,
  min_points  int  not null default 0 check (min_points >= 0),
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);
insert into public.referrer_tiers (code, name, sort_order, min_points) values
  ('nivel1', 'Nível 1', 1,    0),
  ('nivel2', 'Nível 2', 2,   50),
  ('nivel3', 'Nível 3', 3,  150),
  ('nivel4', 'Nível 4', 4,  400),
  ('nivel5', 'Nível 5', 5, 1000)
on conflict (code) do nothing;

-- Benefícios por nível (a definir; ficam aqui, cada um ativável).
create table if not exists public.referrer_benefits (
  id          bigint generated always as identity primary key,
  tier_code   text not null references public.referrer_tiers (code) on delete restrict,
  title       text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.referrer_rankings (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete restrict,
  tier_code   text references public.referrer_tiers (code) on delete restrict,
  points      int  not null,
  metrics     jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);
create index if not exists idx_referrer_rank_user on public.referrer_rankings (user_id, id desc);

create or replace function public.referrer_metrics(p_user uuid) returns table (criterion text, raw_value int)
language sql stable security definer set search_path = '' as $$
  select 'closed_referrals', count(*)::int
    from public.referrals r join public.referrer_links l on l.id = r.link_id
   where l.user_id = p_user and r.stage in ('fechou', 'instalada', 'paga')
  union all
  select 'confirmed_commissions', count(*)::int
    from public.commissions c join public.referrer_links l on l.id = c.link_id
   where l.user_id = p_user and c.confirmed_at is not null
  union all
  select 'companies_count', count(distinct l.company_id)::int
    from public.referrals r join public.referrer_links l on l.id = r.link_id
   where l.user_id = p_user and r.stage in ('fechou', 'instalada', 'paga')
  union all
  select 'months_active',
         greatest(0, (extract(year from age(now(), p.created_at)) * 12 + extract(month from age(now(), p.created_at)))::int)
    from public.profiles p where p.id = p_user
$$;

create or replace function public.referrer_calc(p_user uuid) returns table (points int, tier_code text, metrics jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v_points int; v_tier text; v_metrics jsonb;
begin
  select coalesce(sum(least(m.raw_value * k.weight, coalesce(k.max_points, 2147483647))), 0)::int,
         coalesce(jsonb_object_agg(m.criterion, m.raw_value), '{}'::jsonb)
    into v_points, v_metrics
    from public.referrer_metrics(p_user) m join public.referrer_criteria k on k.code = m.criterion and k.active;
  v_points := greatest(v_points, 0);
  select t.code into v_tier from public.referrer_tiers t
   where t.active and v_points >= t.min_points order by t.sort_order desc limit 1;
  return query select v_points, v_tier, v_metrics;
end $$;

create or replace function public.recalculate_referrer_ranking() returns int
language plpgsql security definer set search_path = '' as $$
declare u record; r record; prev record; n int := 0;
begin
  for u in select distinct l.user_id from public.referrer_links l where l.user_id is not null loop
    select * into r from public.referrer_calc(u.user_id);
    select rk.points, rk.tier_code into prev from public.referrer_rankings rk where rk.user_id = u.user_id order by rk.id desc limit 1;
    if not found or prev.points <> r.points or prev.tier_code is distinct from r.tier_code then
      insert into public.referrer_rankings (user_id, tier_code, points, metrics) values (u.user_id, r.tier_code, r.points, r.metrics);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.admin_recalculate_referrer_ranking() returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  return public.recalculate_referrer_ranking();
end $$;

create or replace function public.admin_save_referrer_tier(p_code text, p_name text, p_sort_order int, p_min_points int, p_active boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  insert into public.referrer_tiers (code, name, sort_order, min_points, active) values (p_code, p_name, p_sort_order, p_min_points, p_active)
  on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order,
        min_points = excluded.min_points, active = excluded.active;
end $$;

create or replace function public.admin_save_referrer_criterion(p_code text, p_weight int, p_max_points int default null, p_active boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  update public.referrer_criteria set weight = p_weight, max_points = p_max_points, active = p_active where code = p_code;
  if not found then raise exception 'Critério inexistente.'; end if;
end $$;

create or replace function public.admin_save_referrer_benefit(p_id bigint, p_tier text, p_title text, p_description text, p_active boolean default true)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  if p_id is null then
    insert into public.referrer_benefits (tier_code, title, description, active) values (p_tier, p_title, p_description, p_active) returning id into v;
  else
    update public.referrer_benefits set tier_code = p_tier, title = p_title, description = p_description, active = p_active where id = p_id returning id into v;
    if v is null then raise exception 'Benefício não encontrado.'; end if;
  end if;
  return v;
end $$;

-- O indicador escolhe se aparece com o nome no ranking (LGPD: padrão é anônimo).
create or replace function public.indicator_set_ranking_opt_in(p_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Entre para continuar.' using errcode = 'insufficient_privilege'; end if;
  update public.profiles set ranking_opt_in = coalesce(p_value, false) where id = auth.uid();
end $$;

-- Último registro de cada indicador + posição (empates dividem a posição).
create or replace view public.referrer_ranking_latest as
select x.user_id, x.tier_code, x.points, rank() over (order by x.points desc) as position, count(*) over () as total
  from (select distinct on (user_id) user_id, tier_code, points from public.referrer_rankings order by user_id, id desc) x;

-- O indicador vê a própria situação: nível, pontos, posição e quanto falta para o próximo nível.
create or replace view public.indicator_my_ranking as
select r.user_id, t.name as tier_name, r.points, r.position, r.total,
       nt.name as next_tier_name, greatest(nt.min_points - r.points, 0) as points_to_next,
       p.ranking_opt_in
  from public.referrer_ranking_latest r
  join public.profiles p on p.id = r.user_id
  left join public.referrer_tiers t on t.code = r.tier_code
  left join public.referrer_tiers nt on nt.active and nt.sort_order = (select min(x.sort_order) from public.referrer_tiers x
                                                                       where x.active and x.min_points > r.points)
 where r.user_id = auth.uid();

-- Classificação geral: só quem aceitou aparece com o nome.
create or replace view public.referrer_leaderboard as
select r.position, case when p.ranking_opt_in then public.short_name(p.full_name) else 'Indicador anônimo' end as display_name,
       t.name as tier_name, r.points, (r.user_id = auth.uid()) as is_me
  from public.referrer_ranking_latest r
  join public.profiles p on p.id = r.user_id
  left join public.referrer_tiers t on t.code = r.tier_code
 where r.position <= 50 or r.user_id = auth.uid()
 order by r.position, 2;

-- Benefícios disponíveis para o meu nível (e os anteriores).
create or replace view public.indicator_benefits as
select b.id, b.title, b.description, t.name as tier_name, t.sort_order
  from public.referrer_benefits b
  join public.referrer_tiers t on t.code = b.tier_code and t.active
  join public.referrer_ranking_latest r on r.user_id = auth.uid()
  join public.referrer_tiers mine on mine.code = r.tier_code
 where b.active and t.sort_order <= mine.sort_order;

-- ---------------------------------------------------------------------
-- 4) Proteções, RLS e permissões
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['platform_settings','customer_groups','seal_certificates','referrer_criteria','referrer_tiers','referrer_benefits'] loop
    execute format('drop trigger if exists trg_no_delete on public.%I', t);
    execute format('create trigger trg_no_delete before delete on public.%I for each row execute function public.forbid_delete()', t);
  end loop;
  foreach t in array array['platform_settings','customer_groups','referrer_criteria','referrer_tiers','referrer_benefits'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
  execute 'drop trigger if exists trg_append_only on public.referrer_rankings';
  execute 'create trigger trg_append_only before update or delete on public.referrer_rankings for each row execute function public.forbid_change()';
  foreach t in array array['platform_settings','customer_groups','seal_certificates','referrer_criteria','referrer_tiers','referrer_benefits'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;
-- seal_certificates tem trava própria (só revogação); o gatilho genérico de bloqueio de delete acima é redundante e inofensivo.

alter table public.platform_settings  enable row level security;
alter table public.customer_groups    enable row level security;
alter table public.seal_certificates  enable row level security;
alter table public.referrer_criteria  enable row level security;
alter table public.referrer_tiers     enable row level security;
alter table public.referrer_benefits  enable row level security;
alter table public.referrer_rankings  enable row level security;

drop policy if exists p_settings_admin   on public.platform_settings;
drop policy if exists p_groups_anon      on public.customer_groups;
drop policy if exists p_groups_read      on public.customer_groups;
drop policy if exists p_cert_read        on public.seal_certificates;
drop policy if exists p_rcriteria_read   on public.referrer_criteria;
drop policy if exists p_rtiers_read      on public.referrer_tiers;
drop policy if exists p_rbenefits_read   on public.referrer_benefits;
drop policy if exists p_rrank_read       on public.referrer_rankings;
create policy p_settings_admin on public.platform_settings for select to authenticated using (public.is_platform_admin());
create policy p_groups_anon    on public.customer_groups   for select to anon using (active);
create policy p_groups_read    on public.customer_groups   for select to authenticated using (active or public.is_platform_admin());
create policy p_cert_read      on public.seal_certificates for select to authenticated using (public.is_company_member(company_id) or public.is_platform_admin());
create policy p_rcriteria_read on public.referrer_criteria for select to authenticated using (active or public.is_platform_admin());
create policy p_rtiers_read    on public.referrer_tiers    for select to authenticated using (active or public.is_platform_admin());
create policy p_rbenefits_read on public.referrer_benefits for select to authenticated using (active or public.is_platform_admin());
create policy p_rrank_read     on public.referrer_rankings for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

revoke all on public.platform_settings, public.customer_groups, public.seal_certificates, public.referrer_criteria,
              public.referrer_tiers, public.referrer_benefits, public.referrer_rankings from anon, authenticated;
grant select on public.customer_groups to anon, authenticated;
grant select on public.platform_settings, public.seal_certificates, public.referrer_criteria,
                public.referrer_tiers, public.referrer_benefits, public.referrer_rankings to authenticated;
grant select on public.company_group_plan, public.company_certificates, public.indicator_my_ranking,
                public.referrer_leaderboard, public.indicator_benefits to authenticated;
-- as visões do ranking só fazem sentido logado; a base interna não é exposta
revoke all on public.referrer_ranking_latest from anon, authenticated;

revoke all on function
  public.seal_certificate_guard(), public.gen_certificate_code(), public.issue_seal_certificates(uuid),
  public.referrer_metrics(uuid), public.referrer_calc(uuid), public.recalculate_referrer_ranking(),
  public.admin_save_customer_group(text, text, text, text, int, boolean), public.admin_set_company_group(uuid, text),
  public.admin_issue_certificates(), public.admin_revoke_certificate(uuid, text), public.verify_certificate(text),
  public.admin_recalculate_referrer_ranking(), public.admin_save_referrer_tier(text, text, int, int, boolean),
  public.admin_save_referrer_criterion(text, int, int, boolean), public.admin_save_referrer_benefit(bigint, text, text, text, boolean),
  public.indicator_set_ranking_opt_in(boolean)
  from public, anon, authenticated;
grant execute on function
  public.admin_save_customer_group(text, text, text, text, int, boolean), public.admin_set_company_group(uuid, text),
  public.admin_issue_certificates(), public.admin_revoke_certificate(uuid, text),
  public.admin_recalculate_referrer_ranking(), public.admin_save_referrer_tier(text, text, int, int, boolean),
  public.admin_save_referrer_criterion(text, int, int, boolean), public.admin_save_referrer_benefit(bigint, text, text, text, boolean),
  public.indicator_set_ranking_opt_in(boolean) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
