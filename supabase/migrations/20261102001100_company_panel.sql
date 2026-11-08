-- =====================================================================
-- Indiki+  |  Painel da empresa: dados cadastrais e visões (v1)
--
--  - companies ganha contato, e-mail financeiro (para cobranças e recibos), site e endereço.
--  - company_update_profile: o administrador da empresa (ou do Indiki+) edita esses dados.
--    CNPJ e razão social só o Indiki+ altera (são a base das faturas e dos recibos).
--  - company_my_companies: as empresas que a pessoa acessa, com o papel dela em cada uma.
--  - company_indicators passa a mostrar como o indicador entrou (convite ou cadastro manual),
--    se já completou o cadastro e quantas vendas fechou.
-- =====================================================================

alter table public.companies add column if not exists phone              text;
alter table public.companies add column if not exists email              text;
alter table public.companies add column if not exists finance_email      text;
alter table public.companies add column if not exists website            text;
alter table public.companies add column if not exists address_zip        text;
alter table public.companies add column if not exists address_street     text;
alter table public.companies add column if not exists address_number     text;
alter table public.companies add column if not exists address_complement text;
alter table public.companies add column if not exists address_district   text;
alter table public.companies add column if not exists address_city       text;
alter table public.companies add column if not exists address_state      text;

alter table public.companies drop constraint if exists companies_state_ok;
alter table public.companies add constraint companies_state_ok check (address_state is null or address_state ~ '^[A-Z]{2}$');
alter table public.companies drop constraint if exists companies_emails_ok;
alter table public.companies add constraint companies_emails_ok check (
  (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') and (finance_email is null or finance_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

-- Administrador da empresa (papel admin) ou do Indiki+.
create or replace function public.is_company_admin(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or exists (
    select 1 from public.company_members where company_id = p_company and user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.company_update_profile(
  p_company uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_finance_email text,
  p_website text,
  p_zip text,
  p_street text,
  p_number text,
  p_complement text,
  p_district text,
  p_city text,
  p_state text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_fin   text := nullif(lower(btrim(coalesce(p_finance_email, ''))), '');
  v_state text := nullif(upper(btrim(coalesce(p_state, ''))), '');
  v_zip   text := nullif(regexp_replace(coalesce(p_zip, ''), '\D', '', 'g'), '');
begin
  if not public.is_company_admin(p_company) then
    raise exception 'Só o administrador da empresa altera estes dados.' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Informe o nome da empresa.'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail de contato inválido.'; end if;
  if v_fin is null then raise exception 'Informe o e-mail financeiro: é para ele que vão as faturas e os recibos.'; end if;
  if v_fin !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail financeiro inválido.'; end if;
  if v_state is not null and v_state !~ '^[A-Z]{2}$' then raise exception 'UF inválida.'; end if;
  if v_zip is not null and length(v_zip) <> 8 then raise exception 'CEP deve ter 8 números.'; end if;
  if public.norm_phone(p_phone) is null and nullif(btrim(coalesce(p_phone, '')), '') is not null then
    raise exception 'Telefone inválido: use DDD + número.';
  end if;

  update public.companies
     set name = btrim(p_name), phone = nullif(btrim(coalesce(p_phone, '')), ''), email = v_email, finance_email = v_fin,
         website = nullif(btrim(coalesce(p_website, '')), ''), address_zip = v_zip,
         address_street = nullif(btrim(coalesce(p_street, '')), ''), address_number = nullif(btrim(coalesce(p_number, '')), ''),
         address_complement = nullif(btrim(coalesce(p_complement, '')), ''), address_district = nullif(btrim(coalesce(p_district, '')), ''),
         address_city = nullif(btrim(coalesce(p_city, '')), ''), address_state = v_state, updated_at = now()
   where id = p_company and archived_at is null;
  if not found then raise exception 'Empresa não encontrada.'; end if;
end $$;

-- As empresas que eu acesso (membro ou admin do Indiki+), com meu papel.
drop view if exists public.company_my_companies;
create view public.company_my_companies as
select c.id, c.name, c.legal_name, c.cnpj, c.status, c.phone, c.email, c.finance_email, c.website,
       c.address_zip, c.address_street, c.address_number, c.address_complement, c.address_district,
       c.address_city, c.address_state, c.customer_group,
       coalesce(m.role::text, case when public.is_platform_admin() then 'plataforma' end) as my_role,
       (m.role = 'admin' or public.is_platform_admin()) as can_edit,
       public.company_plan_code(c.id) as plan_code
  from public.companies c
  left join public.company_members m on m.company_id = c.id and m.user_id = auth.uid()
 where c.archived_at is null and (m.user_id is not null or public.is_platform_admin());

-- Indicadores da empresa (sem CPF e sem PIX: esses só o Indiki+ vê, para pagar).
drop view if exists public.company_indicators;
create view public.company_indicators as
select l.id, l.company_id, l.full_name, l.email, l.phone, l.code, l.active, l.customer_since,
       (l.user_id is not null) as has_account, l.created_at, l.linked_at,
       case when l.invite_id is not null then 'convite' else 'manual' end as via,
       coalesce(p.registration_completed_at is not null, false) as registration_complete,
       (select count(*) from public.referrals r where r.link_id = l.id and r.archived_at is null) as referrals_count,
       (select count(*) from public.referrals r where r.link_id = l.id and r.archived_at is null
           and r.stage in ('fechou', 'instalada', 'paga')) as sales_count
  from public.referrer_links l
  left join public.profiles p on p.id = l.user_id
 where (public.is_company_member(l.company_id) or public.is_platform_admin()) and l.archived_at is null;

-- Produtos da empresa com contagem de indicações e vendas.
drop view if exists public.company_offers;
create view public.company_offers as
select o.id, o.company_id, o.name, o.description, o.commission_fixed_cents, o.commission_percent_bps,
       o.commission_cap_cents, o.grace_days, o.active, o.rule_version, o.created_at,
       (select count(*) from public.referrals r where r.offer_id = o.id and r.archived_at is null) as referrals_count,
       (select count(*) from public.referrals r where r.offer_id = o.id and r.archived_at is null
           and r.stage in ('fechou', 'instalada', 'paga')) as sales_count,
       (select count(*) from public.referrals r where r.offer_id = o.id and r.archived_at is null
           and r.stage in ('indicado', 'orcamento', 'fechou', 'instalada')) as open_count
  from public.offers o
 where (public.is_company_member(o.company_id) or public.is_platform_admin()) and o.archived_at is null;

-- PÚBLICO: página do link de indicação (/i/CÓDIGO). Mostra só a empresa, o primeiro nome
-- de quem indicou e os produtos ativos. Nada de telefone, e-mail ou valores de comissão.
create or replace function public.referral_link_info(p_code text)
returns table (company_name text, referrer_first_name text, offers jsonb)
language sql stable security definer set search_path = '' as $$
  select c.name,
         split_part(btrim(l.full_name), ' ', 1),
         coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'description', o.description) order by o.name)
                     from public.offers o where o.company_id = c.id and o.active and o.archived_at is null), '[]'::jsonb)
    from public.referrer_links l
    join public.companies c on c.id = l.company_id
   where l.code = upper(btrim(coalesce(p_code, ''))) and l.active and l.archived_at is null
     and c.status = 'ativa' and c.archived_at is null
$$;
revoke all on function public.referral_link_info(text) from public;
grant execute on function public.referral_link_info(text) to anon, authenticated;

revoke all on function public.is_company_admin(uuid),
  public.company_update_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.is_company_admin(uuid),
  public.company_update_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, text)
  to authenticated;
grant select on public.company_my_companies, public.company_indicators, public.company_offers to authenticated;
