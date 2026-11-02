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
insert into public.offers (id,company_id,name,commission_fixed_cents,commission_percent_bps,commission_cap_cents,grace_days) values
 ('0f000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Sacada',30000,null,null,0),
 ('0f000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','Box',null,500,null,0),
 ('0f000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002','Pintura',5000,null,null,30);
insert into public.referrer_links (id,company_id,user_id,code,customer_since,full_name,email,phone,phone_digits) values
 ('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','MARINA7K','2026-09-01','Marina Souza','marina@x.com','(19) 90000-1234','19900001234'),
 ('10000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1','MARINA-CN4','2026-07-01','Marina Souza','marina@x.com','(19) 90000-1234','19900001234'),
 ('10000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','RAFAEL3Q','2026-08-01','Rafael Lima','rafael@x.com','(19) 91111-2222','19911112222');

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
select public.company_set_referral_stage((select id from ids where friend_name like 'Carla%'),'fechou', 1850000, 'CT-1001');
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

\echo === 11. Empresa cadastra produto e regra
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select 'produto novo (porcentagem 8%): ' || (public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Guarda-corpo', 'Vidro', null, 800, null, 30, true) is not null);
select pg_temp.expect_fail('percentual acima de 100%', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'X', null, null, 20000)$$);
select pg_temp.expect_fail('comissão zero', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Y', null, 0, null)$$);
select pg_temp.expect_fail('cadastrar em outra empresa', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000002', null, 'Z', null, 100, null)$$);
select pg_temp.expect_fail('editar produto de outra empresa', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000003', 'Z', null, 100, null)$$);
select pg_temp.expect_fail('insert direto em offers', $$insert into public.offers(company_id,name,commission_fixed_cents) values ('c0000000-0000-0000-0000-000000000001','W',1)$$);
select public.company_save_offer('c0000000-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000001', 'Sacada', 'Atualizado', 35000, null, null, 30, true);
select public.company_archive_offer((select id from public.offers where name = 'Guarda-corpo'));
select 'comissão antiga continua 30000: ' || amount_cents from public.company_commissions limit 1;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select pg_temp.expect_fail('indicador cadastra produto', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Q', null, 100, null)$$);
reset role;

\echo === 12. Cadastro manual de indicador pela empresa
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select 'código gerado para Pedro: ' || public.company_register_indicator('c0000000-0000-0000-0000-000000000001','Pedro Álvares','Pedro@Email.com','(11) 98765-4321','2026-10-01');
select pg_temp.expect_fail('cadastro duplicado (mesmo e-mail)', $$select public.company_register_indicator('c0000000-0000-0000-0000-000000000001','Outro Pedro','pedro@email.com',null)$$);
select pg_temp.expect_fail('cadastro duplicado (mesmo telefone)', $$select public.company_register_indicator('c0000000-0000-0000-0000-000000000001','Outro','outro@email.com','11 98765-4321')$$);
select pg_temp.expect_fail('sem e-mail nem telefone', $$select public.company_register_indicator('c0000000-0000-0000-0000-000000000001','Sem Contato')$$);
select pg_temp.expect_fail('e-mail inválido', $$select public.company_register_indicator('c0000000-0000-0000-0000-000000000001','Fulano','isso-nao-e-email')$$);
select pg_temp.expect_fail('cadastrar em outra empresa', $$select public.company_register_indicator('c0000000-0000-0000-0000-000000000002','Fulano','f@x.com')$$);
select public.company_register_indicator('c0000000-0000-0000-0000-000000000001','Ana Lima',null,'(21) 97777-0001');
select public.company_register_indicator('c0000000-0000-0000-0000-000000000001','Ana Lima',null,'(21) 97777-0002');
select 'indicadores da Soulglass (esperado 5): ' || count(*) from public.company_indicators;
select 'Pedro ainda sem conta: ' || (not has_account) from public.company_indicators where full_name like 'Pedro%';
reset role;

\echo --- Pedro entra pela primeira vez (e-mail confirmado)
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b3','pedro@email.com',now(),'{}');
select 'Pedro ligado ao cadastro: ' || (user_id is not null) from public.referrer_links where email='pedro@email.com';
select 'perfil de Pedro usa o nome da empresa: ' || full_name || ' / ' || coalesce(phone,'-') from public.profiles where id='00000000-0000-0000-0000-0000000000b3';
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000b4','estranho@x.com',now());
select 'estranho não ganhou link (esperado 0): ' || count(*) from public.referrer_links where user_id='00000000-0000-0000-0000-0000000000b4';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',false); set role authenticated;
select 'Pedro vê seus links: ' || count(*) || ' (' || string_agg(company_name || ' ' || left(code,6), ',') || ')' from public.indicator_links;
reset role;

\echo --- Amigo diz o nome/telefone de quem indicou
create temp table lk as select (select code from public.referrer_links where email='pedro@email.com') as pedro_code, (select id from public.referrer_links where phone_digits='21977770001') as ana1;
grant select on lk to public;
set role anon;
select 'por telefone com máscara diferente: ' || public.submit_quote_request('Teste Tel','1','0f000000-0000-0000-0000-000000000001', true,'v1', null,'c0000000-0000-0000-0000-000000000001', null, '11 98765 4321');
select 'por nome exato: ' || public.submit_quote_request('Teste Nome','1','0f000000-0000-0000-0000-000000000001', true,'v1', null,'c0000000-0000-0000-0000-000000000001', 'pedro álvares', null);
select 'nome repetido (Ana Lima x2) não adivinha: ' || public.submit_quote_request('Teste Ana','1','0f000000-0000-0000-0000-000000000001', true,'v1', null,'c0000000-0000-0000-0000-000000000001', 'Ana Lima', null);
select 'código com letras minúsculas: ' || (public.submit_quote_request('Teste Cod','1','0f000000-0000-0000-0000-000000000001', true,'v1', (select lower(pedro_code) from lk), null) is not null);
reset role;
select 'achados pelo sistema (esperado 2 com link; 1 sem link): ' || count(*) filter (where link_id is not null) || ' / ' || count(*) filter (where link_id is null) from public.referrals where friend_name in ('Teste Tel','Teste Nome','Teste Ana');

\echo --- Empresa vincula manualmente e o indicador precisa confirmar
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select 'Ana sem vínculo aparece como não encontrada: ' || referrer_not_found from public.company_referrals where friend_name='Teste Ana';
select public.company_link_declared_referrer((select id from public.referrals where friend_name='Teste Ana'), (select ana1 from lk));
select public.company_set_referral_stage((select id from public.referrals where friend_name='Teste Nome'),'orcamento');
select pg_temp.expect_fail('fechar sem o indicador confirmar', format($$select public.company_set_referral_stage(%L,'fechou',500000,'CT-9999')$$, (select id from public.referrals where friend_name='Teste Nome')));
select 'aguardando confirmação: ' || awaiting_referrer_confirmation from public.company_referrals where friend_name='Teste Nome';
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',false); set role authenticated;
select 'Pedro vê pendências (esperado 2: Tel e Nome): ' || count(*) from public.indicator_pending_declarations;
select public.indicator_answer_declared((select id from public.indicator_pending_declarations where friend='Teste N.' or friend like 'Teste Nome%' limit 1), true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_set_referral_stage((select id from public.referrals where friend_name='Teste Nome'),'fechou',500000,'CT-2002');
select 'agora fechou: comissão = ' || amount_cents from public.company_commissions where referral_id=(select id from public.referrals where friend_name='Teste Nome');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',false); set role authenticated;
select 'Pedro recusa a outra pendência: ' ; 
select public.indicator_answer_declared((select id from public.indicator_pending_declarations limit 1), false);
select 'pendências restantes (esperado 0): ' || count(*) from public.indicator_pending_declarations;
reset role;

\echo === 13. Regras de comissão e número do contrato
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select 'cria mista (R$100 + 2%, teto R$800): ' || (public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Mista', null, 10000, 200, 80000, 30, true) is not null);
select 'cria só percentual com teto: ' || (public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Perc teto', null, null, 300, 50000, 30, true) is not null);
select pg_temp.expect_fail('sem regra nenhuma', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Sem regra', null, null, null, null)$$);
select pg_temp.expect_fail('teto menor que o fixo', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Teto baixo', null, 10000, null, 5000)$$);
select pg_temp.expect_fail('porcentagem acima de 50%', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000001', null, 'Perc alto', null, null, 6000, null)$$);
reset role;
create temp table cmx as select (select id from public.offers where name='Mista') as mista, (select id from public.offers where name='Perc teto') as ptt, (select id from public.offers where name='Box') as box;
grant select on cmx to public;
update public.offers set grace_days = 0 where name = 'Mista';
select 'MISTA contrato 20.000 (esperado 50000 = 10000+2%): ' || public.calc_commission(mista, 2000000) from cmx;
select 'MISTA contrato 100.000 (teto 80000): ' || public.calc_commission(mista, 10000000) from cmx;
select 'PERCENTUAL 5% contrato 12.000 (esperado 60000): ' || public.calc_commission(box, 1200000) from cmx;
select 'PERC 3% teto 500 contrato 40.000 (esperado 50000, não 120000): ' || public.calc_commission(ptt, 4000000) from cmx;

set role anon;
select 'indicação mista: ' || public.submit_quote_request('Cliente Medida','1',(select mista from cmx), true,'v1', (select pedro_code from lk), null);
reset role;
create temp table rm as select id from public.referrals where friend_name='Cliente Medida';
grant select on rm to public;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_set_referral_stage((select id from rm),'orcamento');
select pg_temp.expect_fail('fechar sem número do contrato', format($$select public.company_set_referral_stage(%L,'fechou',2000000)$$, (select id from rm)));
select pg_temp.expect_fail('fechar sem valor', format($$select public.company_set_referral_stage(%L,'fechou',null,'CT-3003')$$, (select id from rm)));
select pg_temp.expect_fail('contrato repetido de outra indicação', format($$select public.company_set_referral_stage(%L,'fechou',2000000,' ct-1001 ')$$, (select id from rm)));
select public.company_set_referral_stage((select id from rm),'fechou',2000000,'CT-3003');
select 'comissão calculada na venda (esperado 50000): ' || amount_cents from public.company_commissions where referral_id=(select id from rm);
select pg_temp.expect_fail('corrigir sem motivo', format($$select public.company_correct_sale(%L,1500000,null,'')$$, (select id from rm)));
select 'após desconto p/ 15.000 (esperado 40000): ' || public.company_correct_sale((select id from rm), 1500000, null, 'Desconto de 25% negociado');
select pg_temp.expect_fail('corrigir para contrato já usado', format($$select public.company_correct_sale(%L,1500000,'CT-1001','Erro de digitação')$$, (select id from rm)));
select public.company_set_referral_stage((select id from rm),'instalada');
reset role;
select 'auditoria da correção: ' || count(*) || ' | motivo=' || max(new_data->>'reason') from public.audit_log where action='CORRECAO_VENDA';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'liberadas: ' || public.admin_release_due_commissions();
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_fail('corrigir depois de liberada', format($$select public.company_correct_sale(%L,1000000,null,'Tentando mudar depois')$$, (select id from rm)));
reset role;
select pg_temp.expect_fail('dono do banco muda valor de comissão liberada', $$update public.commissions set amount_cents = 1 where status = 'liberada'$$);
