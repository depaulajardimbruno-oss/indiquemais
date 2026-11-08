-- =====================================================================
-- Indiki+  |  Planos iguais aos do site piloto (v1)
--
--  Os 3 planos à venda passam a ser Mensal, Semestral e Anual: o mesmo acesso completo,
--  muda a fidelidade e a mensalidade. Além da mensalidade, o Indiki+ cobra uma
--  porcentagem sobre as vendas fechadas por indicação (platform_fee_bps), menor
--  quanto maior a fidelidade.
--  Os códigos continuam os mesmos (inicial, intermediario, avancado) para não mexer
--  no histórico das empresas. O Avançado+ fica desativado: reservado para um plano
--  extra no futuro (quem já está nele, como a Soulglass, continua).
-- =====================================================================

alter table public.plans add column if not exists commitment_months int not null default 1;
alter table public.plans drop constraint if exists plans_commitment_ok;
alter table public.plans add constraint plans_commitment_ok check (commitment_months between 1 and 36);

update public.plans set
  name = 'Mensal', description = 'Sem fidelidade. Cancele quando quiser.', sort_order = 1,
  commitment_months = 1, monthly_price_cents = 39700, platform_fee_bps = 100,
  max_active_referrers = null, max_offers = null, max_members = 5,
  report_level = 'completo', crm_integration = true, marketplace_highlight = false, support_level = 'whatsapp',
  active = true, updated_at = now()
where code = 'inicial';

update public.plans set
  name = 'Semestral', description = 'Fidelidade de 6 meses.', sort_order = 2,
  commitment_months = 6, monthly_price_cents = 29700, platform_fee_bps = 80,
  max_active_referrers = null, max_offers = null, max_members = 5,
  report_level = 'completo', crm_integration = true, marketplace_highlight = false, support_level = 'whatsapp',
  active = true, updated_at = now()
where code = 'intermediario';

update public.plans set
  name = 'Anual', description = 'Fidelidade de 12 meses. O melhor preço.', sort_order = 3,
  commitment_months = 12, monthly_price_cents = 19700, platform_fee_bps = 60,
  max_active_referrers = null, max_offers = null, max_members = 5,
  report_level = 'completo', crm_integration = true, marketplace_highlight = false, support_level = 'whatsapp',
  active = true, updated_at = now()
where code = 'avancado';

update public.plans set
  description = 'Plano extra (a definir): sem limites, destaque na vitrine e suporte prioritário.',
  sort_order = 9, active = false, updated_at = now()
where code = 'avancado_mais';
