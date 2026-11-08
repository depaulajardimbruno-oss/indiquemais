-- Cobrança, recibos, retenções e informe de rendimentos. Roda depois de groups_ranking.sql. Só em banco de teste.
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

select '=== 25. Cobrança e faturas';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_save_plan('avancado_mais','Avançado+',null,4,49900,50,null,null,null,'completo',true,true,'prioritario',true);
select public.admin_save_plan('avancado','Avançado',null,3,29900,60,200,null,5,'completo',true,false,'whatsapp',true);
reset role;
select 'faturas geradas: ' || public.generate_invoices(date_trunc('month', now())::date, true);
select pg_temp.expect_eq('gerar de novo não duplica', public.generate_invoices(date_trunc('month', now())::date, true)::text, '0');
select pg_temp.expect_eq('4 faturas: 2 mensalidades + taxa sobre vendas + repasse de comissões',
  (select count(*) filter (where kind='mensalidade') || '+' || count(*) filter (where kind='taxa_vendas') || '+' || count(*) filter (where kind='repasse_comissoes') from public.invoices), '2+1+1');
select pg_temp.expect_eq('repasse = soma das comissões liberadas', (select amount_cents::text from public.invoices where kind='repasse_comissoes'), (select sum(amount_cents)::text from public.commissions where status='liberada'));
select pg_temp.expect_eq('taxa = 0,5% de 38.500,00 (R$ 192,50)', (select amount_cents::text from public.invoices where kind='taxa_vendas'), '19250');
select pg_temp.expect_eq('itens da taxa somam o valor da fatura', (select (sum(amount_cents) = (select amount_cents from public.invoices where kind='taxa_vendas'))::text from public.invoice_items where referral_id is not null), 'true');
select pg_temp.expect_eq('numeração sequencial', (select string_agg(number, ',' order by number) from public.invoices), 'F-2026-000001,F-2026-000002,F-2026-000003,F-2026-000004');
select pg_temp.expect_eq('mês em andamento sem pedido explícito não cobra taxa', public.generate_invoices(date_trunc('month', now())::date, false)::text, '0');

-- cada um vê só o seu
set role anon;
select pg_temp.expect_fail('visitante lê faturas', 'select * from public.company_invoices');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select pg_temp.expect_eq('Casa Nova vê só a sua fatura', (select count(*)::text from public.company_invoices), '1');
select pg_temp.expect_fail('empresa registra o próprio pagamento', format($$select public.admin_record_payment(%L,'pix')$$, (select id from public.company_invoices limit 1)));
select pg_temp.expect_fail('empresa cancela fatura', format($$select public.admin_cancel_invoice(%L,'não quero pagar')$$, (select id from public.company_invoices limit 1)));
select pg_temp.expect_fail('empresa altera valor da fatura', $$update public.invoices set amount_cents = 1$$);
select pg_temp.expect_fail('empresa gera faturas', $$select public.admin_generate_invoices(current_date)$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select pg_temp.expect_eq('indicador não vê faturas', (select count(*)::text from public.company_invoices), '0');
reset role;

select '=== 26. Pagamento e recibo';
create temp table inv as select id, number, company_id, kind, amount_cents from public.invoices;
grant select on inv to public;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('pagamento com forma inválida', format($$select public.admin_record_payment(%L,'cheque')$$, (select id from inv where kind='taxa_vendas')));
select pg_temp.expect_fail('pagamento com data no futuro', format($$select public.admin_record_payment(%L,'pix',null,now()+interval '3 days')$$, (select id from inv where kind='taxa_vendas')));
select 'recibo emitido: ' || public.admin_record_payment((select id from inv where kind='taxa_vendas'), 'pix', 'E2E-123');
select 'recibo 2: ' || public.admin_record_payment((select id from inv where kind='mensalidade' and company_id='c0000000-0000-0000-0000-000000000001'), 'boleto');
select pg_temp.expect_fail('pagar de novo', format($$select public.admin_record_payment(%L,'pix')$$, (select id from inv where kind='taxa_vendas')));
select pg_temp.expect_fail('cancelar fatura paga', format($$select public.admin_cancel_invoice(%L,'erro de lançamento')$$, (select id from inv where kind='taxa_vendas')));
select pg_temp.expect_fail('cancelar sem motivo', format($$select public.admin_cancel_invoice(%L,'')$$, (select id from inv where kind='mensalidade' and company_id='c0000000-0000-0000-0000-000000000002')));
select public.admin_set_fiscal_note((select id from inv where kind='taxa_vendas'), 'NFS-e 1234', 'https://exemplo.gov/nfse/1234');
reset role;
select pg_temp.expect_eq('fatura virou paga', (select status from public.invoices where kind='taxa_vendas'), 'paga');
select pg_temp.expect_eq('recibo numerado', (select string_agg(number, ',' order by number) from public.receipts), 'R-2026-000001,R-2026-000002');
select pg_temp.expect_eq('recibo guarda pagador, valor e forma', (select (payload->>'forma_de_pagamento') || '|' || (payload->>'valor_cents') || '|' || (payload->'pagador'->>'nome') from public.receipts where number='R-2026-000001'), 'pix|19250|Soulglass');
select pg_temp.expect_eq('recibo avisa que não é nota fiscal', (select (payload->>'aviso' ilike '%não substitui a nota fiscal%')::text from public.receipts where number='R-2026-000001'), 'true');
select pg_temp.expect_eq('nota fiscal vinculada à fatura', (select fiscal_note_number from public.invoices where kind='taxa_vendas'), 'NFS-e 1234');
select pg_temp.expect_fail('alterar recibo', $$update public.receipts set amount_cents = 1$$);
select pg_temp.expect_fail('apagar recibo', $$delete from public.receipts$$);
select pg_temp.expect_fail('alterar pagamento', $$update public.invoice_payments set amount_cents = 1$$);
select pg_temp.expect_fail('apagar fatura', $$delete from public.invoices$$);
select pg_temp.expect_fail('dono do banco muda valor da fatura', $$update public.invoices set amount_cents = 1$$);
select pg_temp.expect_fail('dono do banco reabre fatura paga', $$update public.invoices set status='aberta', paid_at=null where status='paga'$$);
select pg_temp.expect_fail('apagar item de fatura', $$delete from public.invoice_items$$);
-- cancelar e refazer: a venda volta a ser cobrável uma única vez
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_cancel_invoice((select id from inv where kind='mensalidade' and company_id='c0000000-0000-0000-0000-000000000002'), 'Plano combinado errado');
reset role;
select pg_temp.expect_eq('fatura cancelada guarda o motivo', (select cancel_reason from public.invoices where company_id='c0000000-0000-0000-0000-000000000002'), 'Plano combinado errado');
select pg_temp.expect_eq('mensalidade cancelada pode ser gerada de novo', public.generate_invoices(date_trunc('month', now())::date, true)::text, '1');
select pg_temp.expect_eq('taxa já paga não é cobrada duas vezes', (select count(*)::text from public.invoices where kind='taxa_vendas' and status <> 'cancelada'), '1');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_eq('empresa vê os próprios recibos', (select count(*)::text from public.company_receipts), '2');
select pg_temp.expect_eq('resumo anual pago ao Indiki+ (R$ 192,50 + R$ 499,00)', (select paid_cents::text from public.company_annual_payments), '69150');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'painel: ' || period_month || ' emitido ' || issued_cents || ' recebido ' || received_cents || ' aberto ' || open_cents || ' vencido ' || overdue_cents from public.admin_billing_overview;
reset role;

select '=== 27. CPF e regras de retenção';
select pg_temp.expect_eq('CPF válido', public.is_valid_cpf('529.982.247-25')::text, 'true');
select pg_temp.expect_eq('CPF com dígitos repetidos', public.is_valid_cpf('111.111.111-11')::text, 'false');
select pg_temp.expect_eq('CPF com dígito errado', public.is_valid_cpf('529.982.247-24')::text, 'false');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select pg_temp.expect_fail('CPF inválido', $$select public.indicator_save_tax_profile('123.456.789-00','Marina Souza')$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false); set role authenticated;
select public.indicator_save_tax_profile('529.982.247-25','Rafael Lima','Rua A, 10');
select pg_temp.expect_eq('não enxerga o CPF de outra pessoa', (select count(*)::text from public.indicator_tax_profiles where user_id='00000000-0000-0000-0000-0000000000b1'), '0');
reset role;
select pg_temp.expect_eq('Rafael só vê o próprio perfil fiscal', (select count(*)::text from public.indicator_tax_profiles), '1');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select pg_temp.expect_eq('Marina não vê o perfil do Rafael', (select count(*)::text from public.indicator_tax_profiles), '0');
select pg_temp.expect_fail('Marina grava na tabela fiscal direto', $$update public.indicator_tax_profiles set cpf='00000000000'$$);
select pg_temp.expect_eq('indicador não enxerga as regras de retenção', (select count(*)::text from public.tax_rules), '0');
select pg_temp.expect_fail('indicador altera regra de retenção', $$select public.admin_save_tax_rule('irrf_comissao',1500,0,true)$$);
reset role;
select pg_temp.expect_fail('CPF duplicado em outro indicador', $$insert into public.indicator_tax_profiles (user_id,cpf,legal_name) values ('00000000-0000-0000-0000-0000000000b1','52998224725','Marina')$$);
select pg_temp.expect_eq('regras nascem desativadas', (select count(*)::text from public.tax_rules where active), '0');
select pg_temp.expect_eq('sem regra ativa: nada retido', (select irrf_cents || '/' || inss_cents from public.compute_withholding(100000)), '0/0');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_save_tax_rule('irrf_comissao', 1500, 10000, true);
select public.admin_save_tax_rule('inss_comissao', 1100, 10000, true);
reset role;
select pg_temp.expect_eq('R$ 1.000,00: IRRF 15% e INSS 11%', (select irrf_cents || '/' || inss_cents from public.compute_withholding(100000)), '15000/11000');
select pg_temp.expect_eq('abaixo da base mínima: nada retido', (select irrf_cents || '/' || inss_cents from public.compute_withholding(5000)), '0/0');

select '=== 28. Repasse da empresa e pagamento ao indicador (com retenção e CPF)';
select pg_temp.expect_eq('comissões já pagas entraram no registro', (select count(*)::text from public.commission_payments), (select count(*)::text from public.commissions where status in ('paga','confirmada','contestada')));
select pg_temp.expect_eq('há comissão liberada esperando o pagamento', (select (count(*) >= 1)::text from public.commissions where status='liberada'), 'true');
update public.platform_settings set value='true' where key in ('require_cpf_for_payout','require_repasse_before_payout');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_pay_month(current_date) is not null as rodou \gset
reset role;
select pg_temp.expect_eq('empresa ainda não repassou: ninguém é pago', (select count(*)::text from public.commissions where status='liberada' and batch_id is not null), '0');
select pg_temp.expect_eq('comissão continua liberada', (select (count(*) >= 1)::text from public.commissions where status='liberada'), 'true');
-- o indicador vê o motivo
select l.user_id as ind from public.commissions c join public.referrer_links l on l.id=c.link_id where c.status='liberada' limit 1 \gset
select set_config('request.jwt.claim.sub', :'ind', false); set role authenticated;
select 'indicador vê: ' || funding_note from public.indicator_commission_funding;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'painel de repasses pendentes: ' || company_name || ' ' || commissions || ' comissão(ões), ' || amount_cents from public.admin_pending_repasse;
-- a empresa paga o repasse
select 'recibo do repasse: ' || public.admin_record_payment((select id from public.invoices where kind='repasse_comissoes' and status='aberta' limit 1), 'pix', 'E2E-REPASSE');
reset role;
select pg_temp.expect_eq('comissão marcada como repassada', (select funded::text from public.commission_funding where commission_id = (select id from public.commissions where status='liberada' limit 1)), 'true');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('pagar mês com indicador sem CPF', $$select public.admin_pay_month(current_date)$$);
reset role;
select pg_temp.expect_eq('bloqueio não deixou pagamento pela metade', (select count(*)::text from public.commissions where status='liberada' and batch_id is not null), '0');
select set_config('request.jwt.claim.sub', :'ind', false); set role authenticated;
select public.indicator_save_tax_profile('111.444.777-35','Indicador de Teste','Rua B, 20');
reset role;
-- desde a migração 15, pagar exige chave PIX
update public.profiles set pix_key = 'pix@teste.com', pix_key_type = 'email' where pix_key is null;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'mês pago: ' || public.admin_pay_month(current_date);
reset role;
select pg_temp.expect_eq('liberadas viraram pagas', (select count(*)::text from public.commissions where status='liberada'), '0');
select pg_temp.expect_eq('pagamento novo: IRRF 15% e INSS 11%, líquido bate', (select (irrf_cents = round(gross_cents*0.15) and inss_cents = round(gross_cents*0.11) and net_cents = gross_cents-irrf_cents-inss_cents)::text from public.commission_payments order by paid_at desc, id limit 1), 'true');
select pg_temp.expect_fail('apagar registro de pagamento de comissão', $$delete from public.commission_payments$$);
select pg_temp.expect_fail('alterar registro de pagamento de comissão', $$update public.commission_payments set irrf_cents = 0$$);
update public.platform_settings set value='false' where key='require_cpf_for_payout';
select 'pendências de CPF (admin): ' || coalesce(sum(payments),0) from public.admin_tax_pending;

select '=== 29. Informe de rendimentos';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('Indicador gera informe', 'select 1') where false;
select 'informes gerados: ' || public.admin_generate_income_statements(extract(year from now())::int);
select pg_temp.expect_eq('gerar de novo não duplica', public.admin_generate_income_statements(extract(year from now())::int)::text, '0');
reset role;
select 'informe: ' || number || ' v' || version || ' ' || beneficiary_name || ' bruto ' || gross_cents || ' irrf ' || irrf_cents || ' inss ' || inss_cents || ' líquido ' || net_cents || ' cpf ' || coalesce(beneficiary_cpf,'-') from public.income_statements order by number;
select pg_temp.expect_eq('informe: bruto - retenções = líquido', (select bool_and(gross_cents - irrf_cents - inss_cents - other_cents = net_cents)::text from public.income_statements), 'true');
select pg_temp.expect_eq('soma dos informes = soma dos pagamentos', (select sum(gross_cents)::text from public.income_statements), (select sum(gross_cents)::text from public.commission_payments where user_id is not null));
-- Marina cadastra o CPF depois: nova versão, a anterior fica
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select public.indicator_save_tax_profile('390.533.447-05','Marina Souza','Rua C, 30');
select pg_temp.expect_eq('Marina vê só os próprios pagamentos', (select count(*)::text from public.indicator_payments), (select count(*)::text from public.commission_payments where user_id='00000000-0000-0000-0000-0000000000b1'));
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_eq('CPF novo gera versão 2', public.admin_generate_income_statements(extract(year from now())::int)::text, '1');
reset role;
select pg_temp.expect_eq('versão 1 foi preservada', (select count(*)::text from public.income_statements where user_id='00000000-0000-0000-0000-0000000000b1'), '2');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select pg_temp.expect_eq('indicador vê qual é a versão atual', (select version::text from public.indicator_income_statements where is_latest), '2');
select pg_temp.expect_eq('informe atual traz o CPF', (select beneficiary_cpf from public.indicator_income_statements where is_latest), '39053344705');
select pg_temp.expect_fail('indicador altera informe', $$update public.income_statements set gross_cents = 0$$);
select pg_temp.expect_fail('indicador gera informe', $$select public.admin_generate_income_statements(2026)$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false); set role authenticated;
select pg_temp.expect_eq('Rafael não vê informes dos outros', (select count(*)::text from public.indicator_income_statements where beneficiary_name like 'Marina%'), '0');
reset role;
select pg_temp.expect_fail('dono do banco altera informe', $$update public.income_statements set gross_cents = 0$$);
select pg_temp.expect_fail('dono do banco apaga informe', $$delete from public.income_statements$$);
select pg_temp.expect_eq('auditoria registra emissão de informe', (select (count(*) > 0)::text from public.audit_log where table_name='income_statements'), 'true');

select '=== 30. Repasse: regras finas';
select pg_temp.expect_eq('repasse não é cobrado duas vezes', public.generate_invoices(date_trunc('month', now())::date, true)::text, '0');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_eq('painel separa receita do repasse', (select (repasse_received_cents > 0 and received_cents = 69150)::text from public.admin_billing_overview), 'true');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_eq('empresa vê quanto repassou e quanto pagou de taxas', (select (repasse_paid_cents > 0 and fees_paid_cents = 69150)::text from public.company_annual_payments), 'true');
select pg_temp.expect_fail('empresa lê funding de comissões', 'select * from public.commission_funding');
reset role;
select pg_temp.expect_eq('faturas pagas em dia contam para o selo', (select raw_value::text from public.company_seal_metrics('c0000000-0000-0000-0000-000000000001') where criterion='fee_on_time'), '3');
