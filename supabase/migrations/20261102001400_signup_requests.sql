-- =====================================================================
-- Indiki+  |  Pedidos de cadastro de empresas e de indicadores + vitrine (v1)
--
-- Empresas:
--   - Página pública "Cadastrar minha empresa" -> company_signup_requests (pendente).
--   - O admin do Indiki+ aprova (cria a empresa e libera o acesso do responsável) ou recusa.
-- Indicadores:
--   - Pelo convite da empresa (já existia): entra aprovado.
--   - Pelo site: a pessoa faz o cadastro completo e pede para indicar empresas da vitrine.
--     Cada empresa escolhe como aparece (companies.listing_mode):
--       fechado   = não aparece; só por convite
--       aprovacao = aparece; o pedido fica pendente até a empresa aceitar ou recusar
--       aberto    = aparece; quem pede já vira indicador
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vitrine: como a empresa aparece para novos indicadores
-- ---------------------------------------------------------------------
alter table public.companies add column if not exists listing_mode text not null default 'aprovacao';
alter table public.companies drop constraint if exists companies_listing_mode_ok;
alter table public.companies add constraint companies_listing_mode_ok check (listing_mode in ('fechado', 'aprovacao', 'aberto'));
alter table public.companies add column if not exists public_description text;

create or replace function public.company_set_listing(p_company uuid, p_mode text, p_description text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_company_admin(p_company) then
    raise exception 'Só o administrador da empresa altera a vitrine.' using errcode = 'insufficient_privilege';
  end if;
  if p_mode not in ('fechado', 'aprovacao', 'aberto') then raise exception 'Opção inválida.'; end if;
  if length(coalesce(p_description, '')) > 400 then raise exception 'Descrição longa demais (máximo 400 caracteres).'; end if;
  update public.companies set listing_mode = p_mode, public_description = nullif(btrim(coalesce(p_description, '')), ''), updated_at = now()
   where id = p_company and archived_at is null;
end $$;

-- PÚBLICO: empresas que aceitam novos indicadores pelo site.
create or replace function public.public_companies()
returns table (id uuid, name text, city text, state text, description text, listing_mode text, offers jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.address_city, c.address_state, c.public_description, c.listing_mode,
         coalesce((select jsonb_agg(jsonb_build_object('name', o.name) order by o.name)
                     from public.offers o where o.company_id = c.id and o.active and o.archived_at is null), '[]'::jsonb)
    from public.companies c
   where c.status = 'ativa' and c.archived_at is null and c.listing_mode <> 'fechado'
   order by c.name
$$;

-- ---------------------------------------------------------------------
-- Pedido do indicador para uma empresa
-- ---------------------------------------------------------------------
alter table public.referrer_links add column if not exists request_status text not null default 'aprovado';
alter table public.referrer_links drop constraint if exists referrer_links_request_status_ok;
alter table public.referrer_links add constraint referrer_links_request_status_ok check (request_status in ('pendente', 'aprovado', 'recusado'));
alter table public.referrer_links add column if not exists requested_at timestamptz;
alter table public.referrer_links add column if not exists decided_at timestamptz;
alter table public.referrer_links add column if not exists decided_by uuid references public.profiles (id) on delete restrict;
alter table public.referrer_links add column if not exists decision_note text;
-- Pedido pendente ou recusado nunca fica ativo (não indica, não aparece no link público).
alter table public.referrer_links drop constraint if exists referrer_links_pending_inactive;
alter table public.referrer_links add constraint referrer_links_pending_inactive check (request_status = 'aprovado' or not active);

create or replace function public.indicator_request_company(p_company uuid) returns text   -- 'aprovado' | 'pendente'
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); p public.profiles; c public.companies; v_email text; v_link public.referrer_links;
begin
  if v_uid is null then raise exception 'Entre para continuar.' using errcode = 'insufficient_privilege'; end if;
  select * into p from public.profiles where id = v_uid;
  if p.registration_completed_at is null then raise exception 'Complete o seu cadastro antes de pedir para indicar uma empresa.'; end if;
  select * into c from public.companies where id = p_company and archived_at is null;
  if not found or c.status <> 'ativa' then raise exception 'Empresa indisponível.'; end if;
  if c.listing_mode = 'fechado' then raise exception 'Esta empresa só aceita indicadores por convite.'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_link from public.referrer_links
   where company_id = p_company and archived_at is null
     and (user_id = v_uid or (user_id is null and (email = v_email or phone_digits = public.norm_phone(p.phone))))
   order by (user_id = v_uid) desc nulls last limit 1 for update;
  if found then
    if v_link.user_id is null then  -- a empresa já tinha cadastrado a pessoa: liga e vale como aprovado
      update public.referrer_links set user_id = v_uid, linked_at = now(), full_name = p.full_name where id = v_link.id;
      return 'aprovado';
    end if;
    if v_link.request_status = 'pendente' then return 'pendente'; end if;
    if v_link.active then raise exception 'Você já indica esta empresa.'; end if;
    raise exception 'A empresa pausou o seu cadastro. Fale com ela para reativar.';
  end if;

  -- Já foi recusado antes (vínculo arquivado): reabre o mesmo cadastro como pedido novo.
  select * into v_link from public.referrer_links where company_id = p_company and user_id = v_uid and request_status = 'recusado' for update;
  if found then
    update public.referrer_links
       set archived_at = null, full_name = p.full_name, phone = p.phone, phone_digits = public.norm_phone(p.phone),
           active = (c.listing_mode = 'aberto'), request_status = case when c.listing_mode = 'aberto' then 'aprovado' else 'pendente' end,
           requested_at = now(), decided_at = case when c.listing_mode = 'aberto' then now() end, decided_by = null, decision_note = null
     where id = v_link.id;
    return case when c.listing_mode = 'aberto' then 'aprovado' else 'pendente' end;
  end if;

  insert into public.referrer_links (company_id, user_id, code, full_name, email, phone, phone_digits, linked_at,
                                     active, request_status, requested_at, decided_at)
  values (p_company, v_uid, public.gen_referral_code(p.full_name), p.full_name, v_email, p.phone, public.norm_phone(p.phone), now(),
          c.listing_mode = 'aberto', case when c.listing_mode = 'aberto' then 'aprovado' else 'pendente' end, now(),
          case when c.listing_mode = 'aberto' then now() end);
  return case when c.listing_mode = 'aberto' then 'aprovado' else 'pendente' end;
end $$;

-- EMPRESA: aceita ou recusa o pedido.
create or replace function public.company_decide_indicator_request(p_link uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.referrer_links;
begin
  select * into l from public.referrer_links where id = p_link for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_company_admin(l.company_id) then
    raise exception 'Só o administrador da empresa aceita ou recusa indicadores.' using errcode = 'insufficient_privilege';
  end if;
  if l.request_status <> 'pendente' then raise exception 'Este pedido já foi respondido.'; end if;
  if p_approve then
    update public.referrer_links set request_status = 'aprovado', active = true, decided_at = now(), decided_by = auth.uid(),
           decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = p_link;
  else
    -- recusado sai da lista (arquivado); a pessoa pode pedir de novo no futuro
    update public.referrer_links set request_status = 'recusado', active = false, decided_at = now(), decided_by = auth.uid(),
           decision_note = nullif(btrim(coalesce(p_note, '')), ''), archived_at = now() where id = p_link;
  end if;
end $$;

-- INDICADOR: todas as minhas empresas e a situação de cada pedido.
drop view if exists public.indicator_my_companies;
create view public.indicator_my_companies as
select l.id, l.company_id, c.name as company_name, l.code, l.request_status, l.active, l.requested_at, l.decided_at, l.decision_note,
       l.archived_at is not null as archived
  from public.referrer_links l
  join public.companies c on c.id = l.company_id
 where l.user_id = auth.uid();

-- Empresa: indicadores + pedidos pendentes (recusados ficam fora por estarem arquivados).
drop view if exists public.company_indicators;
create view public.company_indicators as
select l.id, l.company_id, l.full_name, l.email, l.phone, l.code, l.active, l.customer_since,
       (l.user_id is not null) as has_account, l.created_at, l.linked_at,
       case when l.invite_id is not null then 'convite' when l.requested_at is not null then 'site' else 'manual' end as via,
       l.request_status, l.requested_at,
       coalesce(p.registration_completed_at is not null, false) as registration_complete,
       p.city, p.state, p.profile_kind,
       (select count(*) from public.referrals r where r.link_id = l.id and r.archived_at is null) as referrals_count,
       (select count(*) from public.referrals r where r.link_id = l.id and r.archived_at is null
           and r.stage in ('fechou', 'instalada', 'paga')) as sales_count
  from public.referrer_links l
  left join public.profiles p on p.id = l.user_id
 where (public.is_company_member(l.company_id) or public.is_platform_admin()) and l.archived_at is null;

-- Admin: mesma visão de antes + situação do pedido.
drop view if exists public.admin_indicators;
create view public.admin_indicators as
select l.id, l.company_id, c.name as company_name, l.full_name, l.email, l.phone, l.code, l.active,
       l.user_id is not null as has_account, l.created_at, l.linked_at,
       case when l.invite_id is not null then 'convite' when l.requested_at is not null then 'site' else 'manual' end as via,
       l.request_status,
       coalesce(p.registration_completed_at is not null, false) as registration_complete,
       p.city, p.state, p.profile_kind, p.pix_key_type, p.pix_key,
       case when t.cpf is not null then '***.' || substr(t.cpf, 4, 3) || '.***-' || right(t.cpf, 2) end as cpf_masked,
       (select count(*) from public.referrals r where r.link_id = l.id and r.archived_at is null) as referrals_count,
       (select count(*) from public.referrals r where r.link_id = l.id and r.archived_at is null and r.stage in ('fechou','instalada','paga')) as sales_count,
       coalesce((select sum(m.amount_cents) from public.commissions m where m.link_id = l.id and m.status = 'pendente'), 0) as pending_cents,
       coalesce((select sum(m.amount_cents) from public.commissions m where m.link_id = l.id and m.status = 'liberada'), 0) as released_cents,
       coalesce((select sum(m.amount_cents) from public.commissions m where m.link_id = l.id and m.status in ('paga','confirmada')), 0) as paid_cents
  from public.referrer_links l
  join public.companies c on c.id = l.company_id
  left join public.profiles p on p.id = l.user_id
  left join public.indicator_tax_profiles t on t.user_id = l.user_id
 where l.archived_at is null and public.is_platform_admin();

-- Visão da empresa também passa a trazer o modo da vitrine.
create or replace view public.company_my_companies as
select c.id, c.name, c.legal_name, c.cnpj, c.status, c.phone, c.email, c.finance_email, c.website,
       c.address_zip, c.address_street, c.address_number, c.address_complement, c.address_district,
       c.address_city, c.address_state, c.customer_group,
       coalesce(m.role::text, case when public.is_platform_admin() then 'plataforma' end) as my_role,
       (m.role = 'admin' or public.is_platform_admin()) as can_edit,
       (select h.plan_code from public.company_plan_history h where h.company_id = c.id and h.ends_at is null) as plan_code,
       c.listing_mode, c.public_description
  from public.companies c
  left join public.company_members m on m.company_id = c.id and m.user_id = auth.uid()
 where c.archived_at is null and (m.user_id is not null or public.is_platform_admin());

-- ---------------------------------------------------------------------
-- Pedido de cadastro de empresa
-- ---------------------------------------------------------------------
create table if not exists public.company_signup_requests (
  id            uuid primary key default gen_random_uuid(),
  company_name  text not null check (length(btrim(company_name)) >= 2),
  legal_name    text not null check (length(btrim(legal_name)) >= 3),
  cnpj          text not null check (cnpj ~ '^\d{14}$'),
  contact_name  text not null check (length(btrim(contact_name)) >= 3),
  email         text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text not null,
  city          text,
  state         text check (state is null or state ~ '^[A-Z]{2}$'),
  segment       text,
  message       text check (message is null or length(message) <= 1000),
  consent_at    timestamptz not null,
  status        text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles (id) on delete restrict,
  decision_note text,
  company_id    uuid references public.companies (id) on delete restrict
);
create unique index if not exists uq_signup_pending_cnpj on public.company_signup_requests (cnpj) where status = 'pendente';
alter table public.company_signup_requests enable row level security;
revoke all on public.company_signup_requests from anon, authenticated;
drop trigger if exists trg_no_delete on public.company_signup_requests;
create trigger trg_no_delete before delete on public.company_signup_requests for each row execute function public.forbid_delete();

-- PÚBLICO: envia o pedido.
create or replace function public.submit_company_signup(
  p_company_name text, p_legal_name text, p_cnpj text, p_contact_name text, p_email text, p_phone text,
  p_city text, p_state text, p_segment text, p_message text, p_consent boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'); v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not coalesce(p_consent, false) then raise exception 'É preciso autorizar o contato para enviar o pedido.'; end if;
  if length(btrim(coalesce(p_company_name, ''))) < 2 then raise exception 'Informe o nome da empresa.'; end if;
  if length(btrim(coalesce(p_legal_name, ''))) < 3 then raise exception 'Informe a razão social.'; end if;
  if not public.is_valid_cnpj(v_cnpj) then raise exception 'CNPJ inválido. Confira os números.'; end if;
  if length(btrim(coalesce(p_contact_name, ''))) < 3 then raise exception 'Informe o nome do responsável.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if public.norm_phone(p_phone) is null then raise exception 'Telefone inválido: use DDD + número.'; end if;
  if exists (select 1 from public.companies where cnpj = v_cnpj) then
    raise exception 'Esta empresa já participa do Indiki+. Fale com o responsável por ela ou com o Indiki+.';
  end if;
  if exists (select 1 from public.company_signup_requests where cnpj = v_cnpj and status = 'pendente') then
    raise exception 'Já recebemos um pedido para este CNPJ. Em breve entraremos em contato.';
  end if;
  insert into public.company_signup_requests (company_name, legal_name, cnpj, contact_name, email, phone, city, state, segment, message, consent_at)
  values (btrim(p_company_name), btrim(p_legal_name), v_cnpj, btrim(p_contact_name), v_email, btrim(p_phone),
          nullif(btrim(coalesce(p_city, '')), ''), nullif(upper(btrim(coalesce(p_state, ''))), ''),
          nullif(btrim(coalesce(p_segment, '')), ''), nullif(btrim(coalesce(p_message, '')), ''), now());
end $$;

-- ADMIN: aprova (cria a empresa e libera o acesso do responsável) ou recusa.
create or replace function public.admin_decide_company_signup(p_request uuid, p_approve boolean, p_plan text default 'inicial', p_note text default null)
returns table (company_id uuid, access_status text, access_token text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare r public.company_signup_requests; v_company uuid; g record;
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  select * into r from public.company_signup_requests where id = p_request for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if r.status <> 'pendente' then raise exception 'Este pedido já foi respondido.'; end if;
  if not p_approve then
    update public.company_signup_requests set status = 'recusado', decided_at = now(), decided_by = auth.uid(),
           decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = p_request;
    return query select null::uuid, null::text, null::text;
    return;
  end if;
  v_company := public.admin_create_company(r.company_name, r.legal_name, r.cnpj, null, coalesce(p_plan, 'inicial'));
  update public.companies set email = r.email, phone = r.phone, address_city = r.city, address_state = r.state where id = v_company;
  select * into g from public.company_grant_access(v_company, r.email, 'admin');
  update public.company_signup_requests set status = 'aprovado', decided_at = now(), decided_by = auth.uid(), company_id = v_company,
         decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = p_request;
  return query select v_company, g.status, g.token;
end $$;

drop view if exists public.admin_company_signups;
create view public.admin_company_signups as
select s.*, c.name as approved_company_name
  from public.company_signup_requests s
  left join public.companies c on c.id = s.company_id
 where public.is_platform_admin();

-- Pendências do admin na visão geral.
drop view if exists public.admin_pending;
create view public.admin_pending as
select (select count(*) from public.company_signup_requests where status = 'pendente') as company_signups,
       (select count(*) from public.referrer_links where request_status = 'pendente' and archived_at is null) as indicator_requests
 where public.is_platform_admin();

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on function public.company_set_listing(uuid, text, text), public.public_companies(),
  public.indicator_request_company(uuid), public.company_decide_indicator_request(uuid, boolean, text),
  public.submit_company_signup(text, text, text, text, text, text, text, text, text, text, boolean),
  public.admin_decide_company_signup(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.company_set_listing(uuid, text, text), public.indicator_request_company(uuid),
  public.company_decide_indicator_request(uuid, boolean, text), public.admin_decide_company_signup(uuid, boolean, text, text)
  to authenticated;
grant execute on function public.public_companies(),
  public.submit_company_signup(text, text, text, text, text, text, text, text, text, text, boolean) to anon, authenticated;
grant select on public.indicator_my_companies, public.company_indicators, public.admin_indicators, public.company_my_companies,
  public.admin_company_signups, public.admin_pending to authenticated;
