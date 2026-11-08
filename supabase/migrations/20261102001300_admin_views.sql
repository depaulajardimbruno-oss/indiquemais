-- =====================================================================
-- Indiki+  |  Visões do painel do admin (v1)
-- Tudo aqui é só para o administrador do Indiki+ (is_platform_admin). Para qualquer outra
-- pessoa as visões voltam vazias.
-- =====================================================================

-- Indicadores de todas as empresas, com situação do cadastro e totais de comissão.
-- CPF aparece mascarado; a chave PIX aparece inteira porque é o Indiki+ que paga.
drop view if exists public.admin_indicators;
create view public.admin_indicators as
select l.id, l.company_id, c.name as company_name, l.full_name, l.email, l.phone, l.code, l.active,
       l.user_id is not null as has_account, l.created_at, l.linked_at,
       case when l.invite_id is not null then 'convite' else 'manual' end as via,
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

-- Produtos de todas as empresas.
drop view if exists public.admin_offers;
create view public.admin_offers as
select o.id, o.company_id, c.name as company_name, o.name, o.description, o.commission_fixed_cents, o.commission_percent_bps,
       o.commission_cap_cents, o.grace_days, o.active, o.rule_version, o.created_at,
       (select count(*) from public.referrals r where r.offer_id = o.id and r.archived_at is null) as referrals_count,
       (select count(*) from public.referrals r where r.offer_id = o.id and r.archived_at is null and r.stage in ('fechou','instalada','paga')) as sales_count,
       coalesce((select sum(r.sale_value_cents) from public.referrals r where r.offer_id = o.id and r.archived_at is null and r.stage in ('fechou','instalada','paga')), 0) as sales_cents,
       coalesce((select sum(m.amount_cents) from public.commissions m join public.referrals r on r.id = m.referral_id where r.offer_id = o.id and m.status <> 'cancelada'), 0) as commissions_cents
  from public.offers o
  join public.companies c on c.id = o.company_id
 where o.archived_at is null and public.is_platform_admin();

-- Indicações e vendas de todas as empresas, com a comissão de cada uma.
drop view if exists public.admin_referrals;
create view public.admin_referrals as
select r.id, r.company_id, c.name as company_name, o.name as offer_name, r.offer_id,
       r.link_id, l.full_name as referrer_name, l.code as referrer_code,
       r.friend_name, r.friend_phone, r.source, r.stage, r.created_at, r.stage_changed_at,
       r.sale_value_cents, r.contract_number,
       r.declared_referrer_name, (r.source = 'declarado' and r.declared_confirmed_at is null) as awaiting_confirmation,
       m.id as commission_id, m.amount_cents as commission_cents, m.status as commission_status, m.release_date
  from public.referrals r
  join public.companies c on c.id = r.company_id
  join public.offers o on o.id = r.offer_id
  left join public.referrer_links l on l.id = r.link_id
  left join public.commissions m on m.referral_id = r.id
 where r.archived_at is null and public.is_platform_admin();

-- Comissões de todas as empresas.
drop view if exists public.admin_commissions;
create view public.admin_commissions as
select m.id, m.company_id, c.name as company_name, l.full_name as referrer_name, l.code as referrer_code,
       o.name as offer_name, r.friend_name, r.sale_value_cents, r.contract_number,
       m.amount_cents, m.status, m.release_date, m.paid_at, m.created_at, m.contest_note,
       p.pix_key_type, p.pix_key
  from public.commissions m
  join public.companies c on c.id = m.company_id
  join public.referrer_links l on l.id = m.link_id
  join public.referrals r on r.id = m.referral_id
  join public.offers o on o.id = r.offer_id
  left join public.profiles p on p.id = l.user_id
 where public.is_platform_admin();

-- Números gerais (uma linha).
drop view if exists public.admin_overview;
create view public.admin_overview as
select
  (select count(*) from public.companies where archived_at is null and status = 'ativa') as companies_active,
  (select count(*) from public.companies where archived_at is null and status <> 'ativa') as companies_suspended,
  (select count(*) from public.referrer_links where archived_at is null and active) as indicators_active,
  (select count(*) from public.referrer_links l left join public.profiles p on p.id = l.user_id
     where l.archived_at is null and l.active and (l.user_id is null or p.registration_completed_at is null)) as indicators_incomplete,
  (select count(*) from public.offers where archived_at is null and active) as offers_active,
  (select count(*) from public.referrals where archived_at is null) as referrals_total,
  (select count(*) from public.referrals where archived_at is null and stage = 'indicado') as stage_indicado,
  (select count(*) from public.referrals where archived_at is null and stage = 'orcamento') as stage_orcamento,
  (select count(*) from public.referrals where archived_at is null and stage = 'fechou') as stage_fechou,
  (select count(*) from public.referrals where archived_at is null and stage = 'instalada') as stage_instalada,
  (select count(*) from public.referrals where archived_at is null and stage = 'paga') as stage_paga,
  (select count(*) from public.referrals where archived_at is null and stage = 'perdido') as stage_perdido,
  coalesce((select sum(sale_value_cents) from public.referrals where archived_at is null and stage in ('fechou','instalada','paga')), 0) as sales_cents,
  coalesce((select sum(amount_cents) from public.commissions where status = 'pendente'), 0) as commissions_pending_cents,
  coalesce((select sum(amount_cents) from public.commissions where status = 'liberada'), 0) as commissions_released_cents,
  coalesce((select sum(amount_cents) from public.commissions where status in ('paga','confirmada')), 0) as commissions_paid_cents,
  coalesce((select sum(amount_cents) from public.commissions where status = 'contestada'), 0) as commissions_contested_cents
 where public.is_platform_admin();

-- Resumo por empresa (para comparar lado a lado).
drop view if exists public.admin_company_summary;
create view public.admin_company_summary as
select c.id, c.name, c.status,
       (select pl.name from public.plans pl join public.company_plan_history h on h.plan_code = pl.code
         where h.company_id = c.id and h.ends_at is null) as plan_name,
       (select count(*) from public.company_members m where m.company_id = c.id) as members_count,
       (select count(*) from public.offers o where o.company_id = c.id and o.active and o.archived_at is null) as offers_count,
       (select count(*) from public.referrer_links l where l.company_id = c.id and l.active and l.archived_at is null) as indicators_count,
       (select count(*) from public.referrals r where r.company_id = c.id and r.archived_at is null) as referrals_count,
       (select count(*) from public.referrals r where r.company_id = c.id and r.archived_at is null and r.stage in ('indicado','orcamento','fechou','instalada')) as open_count,
       (select count(*) from public.referrals r where r.company_id = c.id and r.archived_at is null and r.stage in ('fechou','instalada','paga')) as sales_count,
       coalesce((select sum(r.sale_value_cents) from public.referrals r where r.company_id = c.id and r.archived_at is null and r.stage in ('fechou','instalada','paga')), 0) as sales_cents,
       coalesce((select sum(m.amount_cents) from public.commissions m where m.company_id = c.id and m.status not in ('cancelada')), 0) as commissions_cents
  from public.companies c
 where c.archived_at is null and public.is_platform_admin();

grant select on public.admin_indicators, public.admin_offers, public.admin_referrals, public.admin_commissions,
  public.admin_overview, public.admin_company_summary to authenticated;
