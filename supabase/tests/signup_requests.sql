-- Pedidos de cadastro de empresas e indicadores. Roda depois de admin_views.sql. Só em banco de teste.
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

select '=== 41. Pedido de cadastro de empresa';
set role anon;
select pg_temp.expect_fail('sem consentimento', $$select public.submit_company_signup('Vidros Sol','VIDROS SOL LTDA','12.345.678/0001-95','Paulo Sol','paulo@vidrossol.com','(11) 98888-7777','São Paulo','SP','vidraçaria',null,false)$$);
select pg_temp.expect_fail('CNPJ inválido', $$select public.submit_company_signup('Vidros Sol','VIDROS SOL LTDA','12.345.678/0001-00','Paulo Sol','paulo@vidrossol.com','(11) 98888-7777','São Paulo','SP',null,null,true)$$);
select public.submit_company_signup('Vidros Sol','VIDROS SOL LTDA','12.345.678/0001-95','Paulo Sol','Paulo@VidrosSol.com','(11) 98888-7777','São Paulo','sp','vidraçaria','Queremos testar',true);
select pg_temp.expect_fail('mesmo CNPJ de novo', $$select public.submit_company_signup('Vidros Sol','VIDROS SOL LTDA','12345678000195','Paulo Sol','paulo@vidrossol.com','(11) 98888-7777',null,null,null,null,true)$$);
select pg_temp.expect_fail('CNPJ de empresa que já participa', $$select public.submit_company_signup('X','VIDRACARIA X','11.444.777/0001-61','Fulano Tal','f@x.com','(11) 98888-7777',null,null,null,null,true)$$);
select pg_temp.expect_fail('visitante lê pedidos', $$select * from public.company_signup_requests$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_eq('empresa não vê pedidos de cadastro', (select count(*)::text from public.admin_company_signups), '0');
select pg_temp.expect_fail('empresa aprova pedido', $$select * from public.admin_decide_company_signup((select id from public.company_signup_requests limit 1), true)$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_eq('admin vê o pedido pendente', (select status || '|' || email || '|' || state from public.admin_company_signups where cnpj = '12345678000195'), 'pendente|paulo@vidrossol.com|SP');
select pg_temp.expect_eq('pendências na visão geral', (select company_signups::text from public.admin_pending), '1');
select id as sreq from public.admin_company_signups where cnpj = '12345678000195' \gset
select company_id as csol, access_status as ast, access_token as atk from public.admin_decide_company_signup(:'sreq', true, 'intermediario') \gset
select pg_temp.expect_eq('aprovar cria empresa no plano e gera convite do responsável', (select plan_code from public.admin_companies where id = :'csol') || '|' || :'ast' || '|' || (length(:'atk') = 16)::text, 'intermediario|convite|true');
select pg_temp.expect_eq('convite do responsável é para o e-mail do pedido', (select email from public.company_team where company_id = :'csol' and kind = 'convite'), 'paulo@vidrossol.com');
select pg_temp.expect_fail('aprovar de novo', format($$select * from public.admin_decide_company_signup(%L, true)$$, :'sreq'));
reset role;

select '=== 42. Vitrine e pedido de indicador';
set role anon;
select pg_temp.expect_eq('vitrine mostra empresas com aprovação ou abertas', (select count(*)::text from public.public_companies() where name in ('Soulglass Vidros','Vidros Sol')), '2');
reset role;
-- Casa Nova fecha a vitrine; Vidros Sol fica aberta
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select public.company_set_listing('c0000000-0000-0000-0000-000000000002','fechado',null);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.company_set_listing(:'csol','aberto','Vidros temperados em SP');
reset role;
set role anon;
select pg_temp.expect_eq('empresa fechada some da vitrine', (select count(*)::text from public.public_companies() where id = 'c0000000-0000-0000-0000-000000000002'), '0');
reset role;
-- pessoa sem cadastro completo não pede
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000f1','lucas@email.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false); set role authenticated;
select pg_temp.expect_fail('sem cadastro completo', $$select public.indicator_request_company('c0000000-0000-0000-0000-000000000001')$$);
select public.indicator_register(null,'Lucas Martins Silva','(19) 95555-1212','1988-08-08','Campinas','SP','52601815906','email','lucas@email.com','cliente','v1',true);
select pg_temp.expect_eq('empresa com aprovação: pedido fica pendente', public.indicator_request_company('c0000000-0000-0000-0000-000000000001'), 'pendente');
select pg_temp.expect_eq('pedir de novo continua pendente', public.indicator_request_company('c0000000-0000-0000-0000-000000000001'), 'pendente');
select pg_temp.expect_eq('empresa aberta: entra na hora', public.indicator_request_company(:'csol'), 'aprovado');
select pg_temp.expect_fail('empresa fechada', $$select public.indicator_request_company('c0000000-0000-0000-0000-000000000002')$$);
select pg_temp.expect_eq('vê seus pedidos e situações', (select string_agg(company_name || ':' || request_status || ':' || active::text, ',' order by company_name) from public.indicator_my_companies), 'Soulglass Vidros:pendente:false,Vidros Sol:aprovado:true');
reset role;
select code as clucas from public.referrer_links where user_id = '00000000-0000-0000-0000-0000000000f1' and company_id = 'c0000000-0000-0000-0000-000000000001' \gset
set role anon;
select pg_temp.expect_eq('pendente não tem link público', (select count(*)::text from public.referral_link_info(:'clucas')), '0');
reset role;
-- empresa vê o pedido e decide
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false); set role authenticated;
select pg_temp.expect_fail('operador aceita pedido', $$select public.company_decide_indicator_request((select id from public.company_indicators where request_status = 'pendente' limit 1), true)$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select id as lreq from public.company_indicators where request_status = 'pendente' and full_name = 'Lucas Martins Silva' \gset
select pg_temp.expect_eq('empresa vê o pedido vindo do site', (select via || '|' || city from public.company_indicators where id = :'lreq'), 'site|Campinas');
select public.company_decide_indicator_request(:'lreq', true);
select pg_temp.expect_eq('aceito vira ativo', (select request_status || '|' || active::text from public.company_indicators where id = :'lreq'), 'aprovado|true');
select pg_temp.expect_fail('responder de novo', format($$select public.company_decide_indicator_request(%L, false)$$, :'lreq'));
reset role;
set role anon;
select pg_temp.expect_eq('aceito ganha link público', (select count(*)::text from public.referral_link_info(:'clucas')), '1');
reset role;
-- recusa: sai da lista e a pessoa pode pedir de novo
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000f2','julia@email.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f2',false); set role authenticated;
select public.indicator_register(null,'Julia Rocha Lima','(19) 94444-3434','1990-09-09','Campinas','SP','08301661305','email','julia@email.com','cliente','v1',true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f2',false); set role authenticated;
select public.indicator_request_company('c0000000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_decide_indicator_request((select id from public.company_indicators where full_name = 'Julia Rocha Lima'), false, 'Não é cliente');
select pg_temp.expect_eq('recusado sai da lista da empresa', (select count(*)::text from public.company_indicators where full_name = 'Julia Rocha Lima'), '0');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f2',false); set role authenticated;
select pg_temp.expect_eq('indicador vê a recusa com o motivo', (select request_status || '|' || decision_note from public.indicator_my_companies where company_name = 'Soulglass Vidros'), 'recusado|Não é cliente');
select pg_temp.expect_eq('pode pedir de novo', public.indicator_request_company('c0000000-0000-0000-0000-000000000001'), 'pendente');
reset role;
