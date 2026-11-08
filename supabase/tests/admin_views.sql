-- Visões do painel do admin. Roda depois de company_access.sql. Só em banco de teste.
\set ON_ERROR_STOP 0
\pset tuples_only on
create or replace function pg_temp.expect_eq(p_label text, p_got text, p_want text) returns void language plpgsql as $$
begin
  if p_got is not distinct from p_want then raise notice 'ok  %: %', p_label, p_got;
  else raise notice 'FAIL %: obtido=% esperado=%', p_label, p_got, p_want; end if;
end $$;
grant execute on function pg_temp.expect_eq(text,text,text) to public;

select '=== 40. Painel do admin';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_eq('visão geral: 1 linha com totais', (select (count(*) = 1 and bool_and(referrals_total > 0 and companies_active >= 2))::text from public.admin_overview), 'true');
select pg_temp.expect_eq('funil soma o total', (select (stage_indicado + stage_orcamento + stage_fechou + stage_instalada + stage_paga + stage_perdido = referrals_total)::text from public.admin_overview), 'true');
select pg_temp.expect_eq('indicadores de todas as empresas', (select (count(distinct company_id) >= 2)::text from public.admin_indicators), 'true');
select pg_temp.expect_eq('CPF mascarado e PIX visível para o admin', (select cpf_masked || '|' || pix_key from public.admin_indicators where full_name = 'Maria Souza Lima' and company_id = 'c0000000-0000-0000-0000-000000000001'), '***.456.***-09|12345678909');
select pg_temp.expect_eq('produtos com vendas e comissões', (select (sales_count = 2 and commissions_cents > 0)::text from public.admin_offers where name = 'Cobertura'), 'true');
select pg_temp.expect_eq('indicações com nome do indicador e comissão', (select count(*)::text from public.admin_referrals where offer_name = 'Cobertura' and commission_cents is not null), '2');
select pg_temp.expect_eq('comissões de todas as empresas', (select (count(*) = (select count(*) from public.commissions))::text from public.admin_commissions), 'true');
select pg_temp.expect_eq('resumo por empresa bate com o total de indicações', (select (sum(referrals_count) = (select referrals_total from public.admin_overview))::text from public.admin_company_summary), 'true');
reset role;
-- empresa e indicador não veem nada
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_eq('empresa não vê o painel do admin', (select (select count(*) from public.admin_overview) + (select count(*) from public.admin_indicators) + (select count(*) from public.admin_referrals) + (select count(*) from public.admin_commissions) + (select count(*) from public.admin_offers) + (select count(*) from public.admin_company_summary))::text, '0');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated;
select pg_temp.expect_eq('indicador não vê o painel do admin', (select (select count(*) from public.admin_overview) + (select count(*) from public.admin_indicators))::text, '0');
reset role;
set role anon;
select pg_temp.expect_eq('visitante não lê as visões', (select has_table_privilege('anon', 'public.admin_indicators', 'select'))::text, 'false');
reset role;
