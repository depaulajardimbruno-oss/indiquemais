-- Teste de segurança por papel. Roda num Postgres de teste com um "Supabase de mentira"
-- (roles anon/authenticated, auth.users e auth.uid()). NÃO rodar em produção: ele cria dados.
-- Todas as linhas devem sair "ok ..." ou com o resultado esperado indicado no texto.
\set ON_ERROR_STOP 0
\pset tuples_only on
-- helpers
create or replace function pg_temp.expect_fail(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; raise notice 'FAIL (deveria bloquear): %', p_label;
  exception when others then raise notice 'ok  bloqueado: % -> %', p_label, left(sqlerrm, 70); end;
end $$;
grant execute on function pg_temp.expect_fail(text,text) to public;

-- setup como dono do banco
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@x.com','{"full_name":"Admin Indiki"}'),
 ('00000000-0000-0000-0000-0000000000a1','op@soul.com','{"full_name":"Operador Soul"}'),
 ('00000000-0000-0000-0000-0000000000a2','op@casa.com','{"full_name":"Operador Casa"}'),
 ('00000000-0000-0000-0000-0000000000b1','marina@x.com','{"full_name":"Marina Souza"}'),
 ('00000000-0000-0000-0000-0000000000b2','rafael@x.com','{"full_name":"Rafael Lima"}');
update public.profiles set phone='(19) 90000-1234', pix_key='marina@x.com', pix_key_type='email' where id='00000000-0000-0000-0000-0000000000b1';
insert into public.platform_admins values ('00000000-0000-0000-0000-00000000000a');
insert into public.companies (id,name) values ('c0000000-0000-0000-0000-000000000001','Soulglass'),('c0000000-0000-0000-0000-000000000002','Casa Nova');
insert into public.company_members values ('c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','admin'),('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a2','admin');
insert into public.offers (id,company_id,name,commission_type,commission_value,grace_days) values
 ('0f000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Sacada','fixed',30000,0),
 ('0f000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','Box','percent',500,0),
 ('0f000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002','Pintura','fixed',5000,30);
insert into public.referrer_links (id,company_id,user_id,code,customer_since) values
 ('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','MARINA7K','2026-09-01'),
 ('10000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1','MARINA-CN4','2026-07-01'),
 ('10000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','RAFAEL3Q','2026-08-01');

\echo === 1. Visitante sem login
set role anon;
select pg_temp.expect_fail('anon lê referrals', 'select * from public.referrals');
select pg_temp.expect_fail('anon lê commissions', 'select * from public.commissions');
select pg_temp.expect_fail('anon insere referral', $$insert into public.referrals(company_id,offer_id,source,friend_name,friend_phone,consent_at,consent_version) values ('c0000000-0000-0000-0000-000000000001','0f000000-0000-0000-0000-000000000001','direto','x','y',now(),'v1')$$);
select 'anon vê produtos: ' || count(*) from public.public_offers;
select 'pedido pelo link: ' || public.submit_quote_request('Carla Mendes','(19) 98888-0001','0f000000-0000-0000-0000-000000000001', true, 'v1', 'marina7k');
select pg_temp.expect_fail('pedido sem consentimento', $$select public.submit_quote_request('A','1','0f000000-0000-0000-0000-000000000001', false, 'v1', 'MARINA7K')$$);
select pg_temp.expect_fail('link inexistente', $$select public.submit_quote_request('A','1','0f000000-0000-0000-0000-000000000001', true, 'v1', 'NAOEXISTE')$$);
select pg_temp.expect_fail('produto de outra empresa', $$select public.submit_quote_request('A','1','0f000000-0000-0000-0000-000000000003', true, 'v1', 'MARINA7K')$$);
select 'pedido declarado: ' || public.submit_quote_request('João Pereira','(19) 98888-0002','0f000000-0000-0000-0000-000000000002', true, 'v1', null, 'c0000000-0000-0000-0000-000000000001', 'Marina Souza', '19 90000-1234');
select 'pedido direto: ' || public.submit_quote_request('Paulo Rocha','(19) 98888-0003','0f000000-0000-0000-0000-000000000001', true, 'v1', null, 'c0000000-0000-0000-0000-000000000001');
reset role;

\echo === 2. Empresa Soulglass (operador)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select 'vê só as suas indicações (esperado 3): ' || count(*) from public.company_referrals;
select 'não vê a chave PIX: colunas = ' || string_agg(column_name, ',') from information_schema.columns where table_name='company_commissions';
select pg_temp.expect_fail('update direto em referrals', $$update public.referrals set friend_name='x'$$);
select pg_temp.expect_fail('update direto de stage', $$update public.referrals set stage='fechou'$$);
select pg_temp.expect_fail('delete em referrals', 'delete from public.referrals');
select pg_temp.expect_fail('insert em commissions', $$insert into public.commissions(referral_id,company_id,link_id,amount_cents) select id,company_id,link_id,1 from public.referrals limit 1$$);
select 'empresa enxerga o perfil do indicador (esperado 0): ' || count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b1';
\echo (empresa lê a si mesma em profiles: esperado 1 linha)
select count(*) from public.profiles;
reset role;

\echo === 3. Fluxo de etapas (empresa Soulglass)
create temp table ids as select id, friend_name from public.referrals;
grant select on ids to public;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_fail('pular etapa indicado->fechou', format($$select public.company_set_referral_stage(%L,'fechou')$$, (select id from ids where friend_name like 'Carla%')));
select pg_temp.expect_fail('marcar paga', format($$select public.company_set_referral_stage(%L,'paga')$$, (select id from ids where friend_name like 'Carla%')));
select pg_temp.expect_fail('fechar indicação direta (sem indicador)', format($$select public.company_set_referral_stage(%L,'orcamento')$$, (select id from ids where friend_name like 'Paulo%')) || ';' || format($$select public.company_set_referral_stage(%L,'fechou')$$, (select id from ids where friend_name like 'Paulo%')));
select public.company_set_referral_stage((select id from ids where friend_name like 'Carla%'),'orcamento');
select pg_temp.expect_fail('fechar sem valor da venda', format($$select public.company_set_referral_stage(%L,'fechou')$$, (select id from ids where friend_name like 'Carla%')));
select public.company_set_referral_stage((select id from ids where friend_name like 'Carla%'),'fechou', 1850000);
select 'comissão criada (esperado 30000): ' || amount_cents from public.company_commissions;
select public.company_set_referral_stage((select id from ids where friend_name like 'Carla%'),'instalada');
select pg_temp.expect_fail('perdido depois de instalada', format($$select public.company_set_referral_stage(%L,'perdido')$$, (select id from ids where friend_name like 'Carla%')));
reset role;

\echo === 4. Outra empresa não mexe
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select 'Casa Nova vê indicações da Soulglass (esperado 0): ' || count(*) from public.company_referrals;
select pg_temp.expect_fail('Casa Nova muda etapa da Soulglass', format($$select public.company_set_referral_stage(%L,'orcamento')$$, (select id from ids where friend_name like 'Paulo%')));
reset role;

\echo === 5. Indicadora Marina
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select 'minhas indicações (esperado 2: Carla + João pendente não): ' || count(*) from public.indicator_referrals;
select 'nome mascarado: ' || friend from public.indicator_referrals limit 1;
select 'pendentes de confirmação (esperado 1): ' || count(*) from public.indicator_pending_declarations;
select 'RLS: linhas visíveis em referrals (esperado 0): ' || count(*) from public.referrals;
select pg_temp.expect_fail('Marina muda etapa', format($$select public.company_set_referral_stage(%L,'fechou')$$, (select id from ids where friend_name like 'Carla%')));
select pg_temp.expect_fail('Marina update commissions', 'update public.commissions set status=''confirmada''');
select pg_temp.expect_fail('Marina responde antes de pagar', format($$select public.indicator_respond_commission(%L,true)$$, (select id from public.indicator_commissions)));
select public.indicator_answer_declared((select id from public.indicator_pending_declarations), true);
select 'após aceitar: indicações (esperado 2): ' || count(*) from public.indicator_referrals;
select public.indicator_update_payment_info('11999990000','telefone');
reset role;

\echo === 6. Outro indicador (Rafael) não vê nada de Marina
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false); set role authenticated;
select 'Rafael vê (esperado 0): ' || (select count(*) from public.indicator_referrals) || '/' || (select count(*) from public.indicator_commissions);
select pg_temp.expect_fail('Rafael aceita declaração de Marina', format($$select public.indicator_answer_declared(%L,true)$$, (select id from ids where friend_name like 'João%')));
reset role;

\echo === 7. Plataforma fecha o mês
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_fail('empresa tenta pagar mês', $$select public.admin_pay_month(current_date)$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'liberadas: ' || public.admin_release_due_commissions();
select 'lote: ' || (public.admin_pay_month(current_date) is not null);
reset role;

\echo === 8. Marina confirma / contesta
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select 'status: ' || status from public.indicator_commissions;
select public.indicator_respond_commission((select id from public.indicator_commissions), false, 'não caiu');
select 'status: ' || status from public.indicator_commissions;
select pg_temp.expect_fail('responder de novo contestada', format($$select public.indicator_respond_commission(%L,true)$$, (select id from public.indicator_commissions)));
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_resolve_dispute((select id from public.commissions), true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select public.indicator_respond_commission((select id from public.indicator_commissions), true);
select 'status final: ' || status from public.indicator_commissions;
reset role;

\echo === 9. Nada se perde (como dono do banco, o pior caso)
select pg_temp.expect_fail('delete companies', 'delete from public.companies');
select pg_temp.expect_fail('delete referrals', 'delete from public.referrals');
select pg_temp.expect_fail('delete commissions', 'delete from public.commissions');
select pg_temp.expect_fail('delete profiles', 'delete from public.profiles');
select pg_temp.expect_fail('delete auth.users com perfil', 'delete from auth.users');
select pg_temp.expect_fail('truncate referrals', 'truncate public.referrals');
select pg_temp.expect_fail('alterar valor da comissão', 'update public.commissions set amount_cents = 1');
select pg_temp.expect_fail('alterar nome do amigo', $$update public.referrals set friend_name='X'$$);
select pg_temp.expect_fail('alterar histórico', $$update public.referral_stage_history set to_stage='indicado'$$);
select pg_temp.expect_fail('apagar auditoria', 'delete from public.audit_log');
select pg_temp.expect_fail('FK: comissão de empresa errada', $$insert into public.commissions(referral_id,company_id,link_id,amount_cents) select id,'c0000000-0000-0000-0000-000000000002',link_id,1 from public.referrals where stage='paga'$$);
select pg_temp.expect_fail('FK: oferta de outra empresa', $$insert into public.referrals(company_id,offer_id,source,friend_name,friend_phone,consent_at,consent_version) values ('c0000000-0000-0000-0000-000000000001','0f000000-0000-0000-0000-000000000003','direto','x','y',now(),'v1')$$);
select pg_temp.expect_fail('link de outra empresa na indicação', $$insert into public.referrals(company_id,offer_id,link_id,source,friend_name,friend_phone,consent_at,consent_version) values ('c0000000-0000-0000-0000-000000000001','0f000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','link','x','y',now(),'v1')$$);

\echo === 10. Rastro

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;

select 'taxa Soulglass: vendas=' || sales_cents || ' taxa=' || fee_cents from public.company_platform_fees;
reset role;
select 'histórico: ' || string_agg(coalesce(h.from_stage::text,'-') || '>' || h.to_stage::text, ' | ' order by h.id) from public.referral_stage_history h join public.referrals r on r.id=h.referral_id where r.friend_name like 'Carla%';
select 'auditoria: ' || count(*) from public.audit_log;
