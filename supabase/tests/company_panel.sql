-- Painel da empresa: dados cadastrais e visões. Roda depois de indicator_signup.sql. Só em banco de teste.
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

select '=== 35. Dados cadastrais da empresa';
-- a1 é admin da Soulglass
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_eq('lê a linha inteira (select *) sem erro', (select count(*)::text from (select * from public.company_my_companies) x), '1');
select pg_temp.expect_eq('vê só as próprias empresas, com papel admin', (select string_agg(name || ':' || my_role || ':' || can_edit::text, ',') from public.company_my_companies), 'Soulglass:admin:true');
select public.company_update_profile('c0000000-0000-0000-0000-000000000001','Soulglass Vidros','(19) 3333-4444','contato@soulglass.com.br','Financeiro@Soulglass.com.br','soulglass.com.br','13000-000','Rua A','100',null,'Centro','Campinas','sp');
select pg_temp.expect_eq('dados gravados e normalizados', (select name || '|' || finance_email || '|' || address_zip || '|' || address_state from public.company_my_companies), 'Soulglass Vidros|financeiro@soulglass.com.br|13000000|SP');
select pg_temp.expect_fail('sem e-mail financeiro', $$select public.company_update_profile('c0000000-0000-0000-0000-000000000001','Soulglass','','','','','','','','','','','')$$);
select pg_temp.expect_fail('CEP curto', $$select public.company_update_profile('c0000000-0000-0000-0000-000000000001','Soulglass','','','fin@x.com','','123','','','','','','')$$);
select pg_temp.expect_fail('UF inválida', $$select public.company_update_profile('c0000000-0000-0000-0000-000000000001','Soulglass','','','fin@x.com','','','','','','','','Sao Paulo')$$);
select pg_temp.expect_fail('editar outra empresa', $$select public.company_update_profile('c0000000-0000-0000-0000-000000000002','Casa Nova','','','fin@x.com','','','','','','','','')$$);
select pg_temp.expect_fail('alterar CNPJ direto', $$update public.companies set cnpj = '11111111111111' where id = 'c0000000-0000-0000-0000-000000000001'$$);
reset role;

-- operador não edita
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000d1','operador@soulglass.com',now());
insert into public.company_members (company_id, user_id, role) values ('c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1','operador');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false); set role authenticated;
select pg_temp.expect_eq('operador vê a empresa sem poder editar', (select my_role || ':' || can_edit::text from public.company_my_companies), 'operador:false');
select pg_temp.expect_fail('operador edita dados', $$select public.company_update_profile('c0000000-0000-0000-0000-000000000001','X','','','fin@x.com','','','','','','','','')$$);
reset role;

-- admin do Indiki+ vê todas
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_eq('admin do Indiki+ vê todas as empresas', (select (count(*) >= 2)::text from public.company_my_companies), 'true');
select pg_temp.expect_eq('admin do Indiki+ pode editar', (select bool_and(can_edit)::text from public.company_my_companies), 'true');
reset role;

-- indicador não vê empresa nenhuma
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated;
select pg_temp.expect_eq('indicador não vê dados da empresa', (select count(*)::text from public.company_my_companies), '0');
select pg_temp.expect_eq('indicador não vê lista de indicadores', (select count(*)::text from public.company_indicators), '0');
reset role;

select '=== 36. Visões de indicadores e produtos';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_eq('indicadores por convite aparecem com via=convite', (select count(*)::text from public.company_indicators where company_id='c0000000-0000-0000-0000-000000000001' and via = 'convite'), '2');
select pg_temp.expect_eq('cadastro completo aparece', (select bool_and(registration_complete)::text from public.company_indicators where company_id='c0000000-0000-0000-0000-000000000001' and via = 'convite'), 'true');
select pg_temp.expect_fail('visão não expõe CPF', $$select cpf from public.company_indicators$$);
select pg_temp.expect_eq('produtos com contagem', (select (count(*) > 0 and bool_and(referrals_count >= 0))::text from public.company_offers where company_id='c0000000-0000-0000-0000-000000000001'), 'true');
select pg_temp.expect_eq('produto Cobertura com 3 indicações e 2 vendas', (select referrals_count || '/' || sales_count from public.company_offers where name = 'Cobertura'), '3/2');
select pg_temp.expect_eq('não vê produtos de outra empresa', (select count(*)::text from public.company_offers where company_id='c0000000-0000-0000-0000-000000000002'), '0');
reset role;

select '=== 37. Página pública do link de indicação';
select code as cnovo from public.referrer_links where full_name = 'Novo Cliente Teste' \gset
select code as cmaria from public.referrer_links where full_name = 'Maria Souza Lima' and company_id = 'c0000000-0000-0000-0000-000000000001' \gset
set role anon;
select pg_temp.expect_eq('visitante vê empresa, primeiro nome e produtos', (select company_name || '|' || referrer_first_name || '|' || (jsonb_array_length(offers) > 0)::text from public.referral_link_info(:'cnovo')), 'Soulglass Vidros|Novo|true');
select pg_temp.expect_eq('não expõe comissão nos produtos', (select (offers::text not ilike '%commission%' and offers::text not ilike '%cents%')::text from public.referral_link_info(:'cnovo')), 'true');
select pg_temp.expect_eq('código pausado não aparece', (select count(*)::text from public.referral_link_info(:'cmaria')), '0');
select pg_temp.expect_eq('código inexistente não aparece', (select count(*)::text from public.referral_link_info('XXXX-0000')), '0');
reset role;
