-- PIX opcional, painel do indicador, link com WhatsApp. Roda depois de signup_requests.sql. Só em banco de teste.
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

select '=== 43. PIX opcional no cadastro';
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000f3','rita@email.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f3',false); set role authenticated;
select pg_temp.expect_fail('CPF continua obrigatório', $$select public.indicator_register(null,'Rita Alves Souza','(19) 93333-1111','1985-01-01','Campinas','SP','',null,null,'cliente','v1',true)$$);
select public.indicator_register(null,'Rita Alves Souza','(19) 93333-1111','1985-01-01','Campinas','SP','66392332154',null,null,'cliente','v1',true);
select pg_temp.expect_eq('cadastro completo sem PIX', (select completed::text || '|' || coalesce(pix_key, 'sem pix') from public.indicator_my_profile), 'true|sem pix');
select pg_temp.expect_fail('PIX inválido quando informado', $$select public.indicator_set_pix('telefone','123')$$);
select public.indicator_set_pix('email','Rita@Email.com');
select pg_temp.expect_eq('PIX cadastrado depois', (select pix_key_type || ':' || pix_key from public.indicator_my_profile), 'email:rita@email.com');
-- recadastro sem PIX não apaga o PIX existente
select public.indicator_register(null,'Rita Alves Souza','(19) 93333-1111','1985-01-01','Campinas','SP','','',null,'cliente','v1',true);
select pg_temp.expect_eq('recadastro sem PIX mantém o PIX', (select pix_key from public.indicator_my_profile), 'rita@email.com');
reset role;
set role anon;
select pg_temp.expect_fail('visitante cadastra PIX', $$select public.indicator_set_pix('email','x@y.com')$$);
reset role;

select '=== 44. Pagamento exige PIX';
-- indicação da Rita na Soulglass, fechada e instalada
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f3',false); set role authenticated;
select public.indicator_request_company('c0000000-0000-0000-0000-000000000001');
reset role;
update public.profiles set pix_key = null, pix_key_type = null where id = '00000000-0000-0000-0000-0000000000f3';
update public.referrer_links set request_status = 'aprovado', active = true where user_id = '00000000-0000-0000-0000-0000000000f3' and company_id = 'c0000000-0000-0000-0000-000000000001';
select code as crita from public.referrer_links where user_id = '00000000-0000-0000-0000-0000000000f3' and company_id = 'c0000000-0000-0000-0000-000000000001' \gset
select public.submit_quote_request('Pedro Amigo','(19) 92222-0000',(select id from public.offers where name = 'Cobertura'),true,'orcamento-v1',:'crita') as rq \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_set_referral_stage(:'rq','orcamento');
select public.company_set_referral_stage(:'rq','fechou', 500000, 'CT-RITA-1');
select pg_temp.expect_eq('empresa vê a regra congelada e a comissão', (select rule_fixed_cents || '|' || commission_cents || '|' || commission_status from public.company_referrals where id = :'rq'), '20000|20000|pendente');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f3',false); set role authenticated;
select pg_temp.expect_eq('indicadora vê a indicação com a comissão', (select stage || '|' || commission_cents || '|' || friend from public.indicator_my_referrals where id = :'rq'), 'fechou|20000|Pedro A.');
select pg_temp.expect_fail('indicadora não vê valor da venda', $$select sale_value_cents from public.indicator_my_referrals$$);
reset role;
insert into public.payout_batches (month_ref) values ('2030-01-01') on conflict do nothing;
update public.commissions set status = 'liberada' where referral_id = :'rq';
select pg_temp.expect_fail('pagar comissão sem PIX', format($$update public.commissions set status = 'paga', batch_id = (select id from public.payout_batches where month_ref = '2030-01-01'), paid_at = now() where referral_id = %L$$, :'rq'));
reset role;

select '=== 45. Link público com WhatsApp da empresa';
set role anon;
select pg_temp.expect_eq('link traz o telefone da empresa', (select company_phone from public.referral_link_info(:'crita')), '(19) 3333-4444');
reset role;
