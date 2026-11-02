-- Regra de comissão congelada na indicação + histórico de versões. Roda depois de billing_tax.sql. Só em banco de teste.
\set ON_ERROR_STOP 0
\pset tuples_only on
create or replace function pg_temp.expect_fail(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; raise notice 'FAIL (deveria bloquear): %', p_label;
  exception when others then raise notice 'ok  bloqueado: % -> %', p_label, left(sqlerrm, 70); end;
end $$;
grant execute on function pg_temp.expect_fail(text,text) to public;
create or replace function pg_temp.expect_eq(p_label text, p_got text, p_want text) returns void language plpgsql as $$
begin
  if p_got is not distinct from p_want then raise notice 'ok  %: %', p_label, p_got;
  else raise notice 'FAIL %: obtido=% esperado=%', p_label, p_got, p_want; end if;
end $$;
grant execute on function pg_temp.expect_eq(text,text,text) to public;

select '=== 31. Regra congelada na indicação';
-- Empresa 1 cria o produto "Cobertura" com R$ 300 fixo.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Cobertura', null, 30000, null, null, 30, true) as o \gset
reset role;
select pg_temp.expect_eq('produto nasce na versão 1', (select rule_version::text from public.offers where id = :'o'), '1');

-- Duas indicações criadas com R$ 300.
insert into public.referrals (id, company_id, offer_id, link_id, source, friend_name, friend_phone, consent_at, consent_version)
values ('e1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001', :'o','10000000-0000-0000-0000-000000000001','link','Ana','11900000001',now(),'v1'),
       ('e1000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', :'o','10000000-0000-0000-0000-000000000001','link','Bia','11900000002',now(),'v1');
select pg_temp.expect_eq('indicação guarda a foto (R$ 300, v1)', (select rule_fixed_cents || '/v' || rule_version from public.referrals where id='e1000000-0000-0000-0000-000000000001'), '30000/v1');

-- A empresa reduz para R$ 200.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_save_offer('c0000000-0000-0000-0000-000000000001', :'o', 'Cobertura', null, 20000, null, null, 30, true);
reset role;
select pg_temp.expect_eq('produto foi para a versão 2', (select rule_version::text from public.offers where id = :'o'), '2');
select pg_temp.expect_eq('salvar sem mudar a regra não cria versão', (select (public.company_save_offer('c0000000-0000-0000-0000-000000000001', :'o', 'Cobertura', 'nova descrição', 20000, null, null, 30, true) is not null)::text || (select rule_version from public.offers where id = :'o')), 'true2');
select pg_temp.expect_eq('histórico tem 2 versões', (select count(*)::text from public.offer_rule_versions where offer_id = :'o'), '2');

-- Indicação antiga continua em R$ 300; a nova nasce com R$ 200.
insert into public.referrals (id, company_id, offer_id, link_id, source, friend_name, friend_phone, consent_at, consent_version)
values ('e1000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001', :'o','10000000-0000-0000-0000-000000000001','link','Caio','11900000003',now(),'v1');
select pg_temp.expect_eq('indicação nova pega R$ 200 (v2)', (select rule_fixed_cents || '/v' || rule_version from public.referrals where id='e1000000-0000-0000-0000-000000000003'), '20000/v2');
select pg_temp.expect_eq('indicação antiga segue R$ 300 (v1)', (select rule_fixed_cents || '/v' || rule_version from public.referrals where id='e1000000-0000-0000-0000-000000000001'), '30000/v1');

-- Fechar venda: comissão sai da foto, não do produto.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_set_referral_stage('e1000000-0000-0000-0000-000000000001','orcamento');
select public.company_set_referral_stage('e1000000-0000-0000-0000-000000000001','fechou', 1000000, 'CT-9001');
select public.company_set_referral_stage('e1000000-0000-0000-0000-000000000003','orcamento');
select public.company_set_referral_stage('e1000000-0000-0000-0000-000000000003','fechou', 1000000, 'CT-9003');
reset role;
select pg_temp.expect_eq('antiga fechou com R$ 300', (select amount_cents::text from public.commissions where referral_id='e1000000-0000-0000-0000-000000000001'), '30000');
select pg_temp.expect_eq('nova fechou com R$ 200', (select amount_cents::text from public.commissions where referral_id='e1000000-0000-0000-0000-000000000003'), '20000');

-- Correção de valor do contrato mantém a regra da foto.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_eq('corrigir contrato da antiga mantém R$ 300', public.company_correct_sale('e1000000-0000-0000-0000-000000000001', 900000, null, 'desconto concedido')::text, '30000');

-- Empresa não consegue mexer na foto nem direto no banco.
select pg_temp.expect_fail('empresa edita a foto da indicação', $$update public.referrals set rule_fixed_cents = 1 where id='e1000000-0000-0000-0000-000000000001'$$);
select pg_temp.expect_fail('empresa usa a função do admin', $$select public.admin_correct_referral_rule('e1000000-0000-0000-0000-000000000001', 1000, null, null, 30, 'tentando mexer')$$);
select pg_temp.expect_fail('empresa lê versões direto da tabela', $$select * from public.offer_rule_versions$$);
select pg_temp.expect_eq('empresa vê o histórico da regra (2 versões)', (select count(*)::text from public.company_offer_rule_history where offer_id = (select id from public.offers where name='Cobertura')), '2');
select pg_temp.expect_eq('v1 tem 2 indicações em andamento (Ana e Bia)', (select open_referrals_count::text from public.company_offer_rule_history where offer_id = (select id from public.offers where name='Cobertura') and version = 1), '2');
reset role;
-- Mesmo o postgres fora da função não muda a foto.
select pg_temp.expect_fail('UPDATE direto da foto sem exceção', $$update public.referrals set rule_percent_bps = 500 where id='e1000000-0000-0000-0000-000000000001'$$);
select pg_temp.expect_fail('versão do histórico não se apaga', $$delete from public.offer_rule_versions$$);
select pg_temp.expect_fail('versão do histórico não se altera', $$update public.offer_rule_versions set fixed_cents = 1$$);

-- Admin corrige uma indicação com motivo.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('admin sem motivo', $$select public.admin_correct_referral_rule('e1000000-0000-0000-0000-000000000003', 25000, null, null, 30, '')$$);
select pg_temp.expect_eq('admin corrige regra e a comissão pendente acompanha', public.admin_correct_referral_rule('e1000000-0000-0000-0000-000000000003', 25000, null, null, 30, 'erro de digitação na regra')::text, '25000');
select pg_temp.expect_eq('auditoria da correção gravada', (select count(*)::text from public.audit_log where action='CORRECAO_REGRA' and row_id='e1000000-0000-0000-0000-000000000003'), '1');
reset role;
update public.commissions set status = 'liberada' where referral_id='e1000000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('admin depois de liberada', $$select public.admin_correct_referral_rule('e1000000-0000-0000-0000-000000000003', 1000, null, null, 30, 'tarde demais')$$);
reset role;
