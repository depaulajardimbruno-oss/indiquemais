-- Empresa registra indicação recebida por fora. Roda depois de pix_panel.sql. Só em banco de teste.
\set ON_ERROR_STOP 0
\pset tuples_only on
create or replace function pg_temp.expect_fail(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; raise notice 'FAIL (deveria bloquear): %', p_label;
  exception when others then raise notice 'ok  bloqueado: % -> %', p_label, left(sqlerrm, 80); end;
end $$;
grant execute on function pg_temp.expect_fail(text,text) to public;
create or replace function pg_temp.expect_eq(p_label text, p_got text, p_want text) returns void language plpgsql as $$
begin
  if p_got is not distinct from p_want then raise notice 'ok  %: %', p_label, p_got;
  else raise notice 'FAIL %: obtido=% esperado=%', p_label, p_got, p_want; end if;
end $$;
grant execute on function pg_temp.expect_eq(text,text,text) to public;

select '=== 46. Empresa registra indicação por fora';
select id as lrita from public.referrer_links where user_id = '00000000-0000-0000-0000-0000000000f3' and company_id = 'c0000000-0000-0000-0000-000000000001' \gset
select id as ofr from public.offers where name = 'Cobertura' \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false); set role authenticated;
-- operador também registra (é atendimento do dia a dia)
select public.company_register_referral('c0000000-0000-0000-0000-000000000001', :'ofr', 'Helena Costa', '(19) 91111-2222', :'lrita', true, 'veio pela loja') as rid \gset
reset role;
select pg_temp.expect_eq('nasce declarada, ligada à indicadora e aguardando confirmação', (select source || '|' || (link_id = :'lrita')::text || '|' || (declared_confirmed_at is null)::text || '|' || stage from public.referrals where id = :'rid'), 'declarado|true|true|indicado');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_fail('sem autorização do cliente', format($$select public.company_register_referral('c0000000-0000-0000-0000-000000000001', %L, 'X Y', '(19) 90000-0001', %L, false)$$, :'ofr', :'lrita'));
select pg_temp.expect_fail('cliente repetido em andamento', format($$select public.company_register_referral('c0000000-0000-0000-0000-000000000001', %L, 'Helena C', '19 91111-2222', %L, true)$$, :'ofr', :'lrita'));
select pg_temp.expect_fail('indicador de outra empresa', format($$select public.company_register_referral('c0000000-0000-0000-0000-000000000001', %L, 'Ze Silva', '(19) 90000-0002', (select id from public.referrer_links where company_id = 'c0000000-0000-0000-0000-000000000002' limit 1), true)$$, :'ofr'));
select pg_temp.expect_fail('produto de outra empresa', format($$select public.company_register_referral('c0000000-0000-0000-0000-000000000001', (select id from public.offers where company_id = 'c0000000-0000-0000-0000-000000000002' limit 1), 'Ze Silva', '(19) 90000-0002', %L, true)$$, :'lrita'));
select public.company_set_referral_stage(:'rid','orcamento');
select pg_temp.expect_fail('fechar antes do indicador confirmar', format($$select public.company_set_referral_stage(%L,'fechou', 300000, 'CT-HEL-1')$$, :'rid'));
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated;
select pg_temp.expect_fail('outra empresa/pessoa não registra aqui', format($$select public.company_register_referral('c0000000-0000-0000-0000-000000000001', %L, 'Ze Silva', '(19) 90000-0003', %L, true)$$, :'ofr', :'lrita'));
reset role;
-- indicadora confirma no painel
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f3',false); set role authenticated;
select pg_temp.expect_eq('aparece para a indicadora confirmar', (select friend from public.indicator_pending_declarations where id = :'rid'), 'Helena C.');
select public.indicator_answer_declared(:'rid', true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_set_referral_stage(:'rid','fechou', 300000, 'CT-HEL-1');
select pg_temp.expect_eq('confirmada: fecha e gera comissão', (select stage || '|' || commission_cents from public.company_referrals where id = :'rid'), 'fechou|20000');
reset role;
select pg_temp.expect_eq('registro fica na auditoria', (select count(*)::text from public.audit_log where action = 'REGISTRO_EMPRESA' and row_id = :'rid'), '1');
