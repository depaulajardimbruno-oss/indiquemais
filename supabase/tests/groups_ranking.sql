-- Grupos de cliente, certificados e ranking. Roda depois de plans_seals.sql. Só em banco de teste.
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

select '=== 21. Grupos de cliente';
set role anon;
select pg_temp.expect_eq('visitante vê 4 grupos', (select count(*)::text from public.customer_groups), '4');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select pg_temp.expect_fail('empresa escolhe o próprio grupo', $$select public.admin_set_company_group('c0000000-0000-0000-0000-000000000002','grande')$$);
select pg_temp.expect_fail('empresa edita grupo', $$select public.admin_save_customer_group('grande','X',null,'inicial',1,true)$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_set_company_group('c0000000-0000-0000-0000-000000000002','pequena');
select pg_temp.expect_eq('grupo sugere plano', (select recommended_plan_code from public.company_group_plan where company_id='c0000000-0000-0000-0000-000000000002'), 'intermediario');
select pg_temp.expect_eq('sugerido difere do atual (avancado)', (select plan_differs::text from public.company_group_plan where company_id='c0000000-0000-0000-0000-000000000002'), 'true');
select public.admin_save_customer_group('pequena','Pequena empresa','x','intermediario',2,false);
select pg_temp.expect_fail('grupo desativado não pode ser atribuído', $$select public.admin_set_company_group('c0000000-0000-0000-0000-000000000001','pequena')$$);
select pg_temp.expect_fail('grupo inexistente', $$select public.admin_set_company_group('c0000000-0000-0000-0000-000000000001','xyz')$$);
select public.admin_save_customer_group('pequena','Pequena empresa','Equipe pequena e carteira em crescimento.','intermediario',2,true);
reset role;
select pg_temp.expect_fail('apagar grupo', $$delete from public.customer_groups where code='pequena'$$);

select '=== 22. Certificados do selo';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'recalcula selos: ' || public.admin_recalculate_seals();
select pg_temp.expect_eq('toda empresa com selo tem certificado válido', (select count(*)::text from public.company_certificates where status='valido'), '2');
select pg_temp.expect_eq('emitir de novo não duplica', public.admin_issue_certificates()::text, '0');
reset role;
create temp table cert as select id, verification_code as code from public.seal_certificates where company_id='c0000000-0000-0000-0000-000000000001' and revoked_at is null;
grant select on cert to public;
set role anon;
select pg_temp.expect_eq('verificação pública: válido', (select status from public.verify_certificate((select code from cert))), 'valido');
select pg_temp.expect_eq('verificação aceita minúsculas e espaços', (select status from public.verify_certificate(' '||lower((select code from cert))||' ')), 'valido');
select pg_temp.expect_eq('código inexistente', (select status from public.verify_certificate('IM-AAAA-BBBB')), 'inexistente');
select pg_temp.expect_fail('visitante lista certificados', 'select * from public.seal_certificates');
select pg_temp.expect_fail('visitante lê view de certificados', 'select * from public.company_certificates');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select pg_temp.expect_eq('empresa vê só o próprio certificado', (select count(*)::text from public.company_certificates), '1');
select pg_temp.expect_fail('empresa revoga certificado', format($$select public.admin_revoke_certificate(%L,'quero revogar')$$, (select id from cert)));
reset role;
select pg_temp.expect_fail('trocar dono do certificado', format($$update public.seal_certificates set company_id='c0000000-0000-0000-0000-000000000002' where id=%L$$, (select id from cert)));
select pg_temp.expect_fail('apagar certificado', $$delete from public.seal_certificates$$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('revogar sem motivo', format($$select public.admin_revoke_certificate(%L,'')$$, (select id from cert)));
-- mudança de nível revoga o antigo e emite o novo
select public.admin_save_seal_level('prata','Prata',2,0,3,true);
select public.admin_recalculate_seals();
reset role;
set role anon;
select pg_temp.expect_eq('certificado antigo revogado ao subir de nível', (select status from public.verify_certificate((select code from cert))), 'revogado');
reset role;
select pg_temp.expect_eq('novo certificado Prata válido', (select count(*)::text from public.seal_certificates k join public.seal_levels l on l.code=k.level_code where k.company_id='c0000000-0000-0000-0000-000000000001' and k.revoked_at is null and l.name='Prata'), '1');
select pg_temp.expect_fail('reabrir certificado revogado', format($$update public.seal_certificates set revoked_at=null, revoked_reason=null where id=%L$$, (select id from cert)));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_revoke_certificate((select id from public.seal_certificates where company_id='c0000000-0000-0000-0000-000000000001' and revoked_at is null), 'Uso indevido do selo');
select pg_temp.expect_fail('revogar duas vezes', format($$select public.admin_revoke_certificate(%L,'de novo, sem efeito')$$, (select id from cert)));
select public.admin_save_seal_level('prata','Prata',2,100,5,true);
select public.admin_recalculate_seals();
reset role;
-- certificado vencido
update public.platform_settings set value='1' where key='seal_certificate_validity_days';
select pg_temp.expect_eq('configuração de validade editável', (select value from public.platform_settings where key='seal_certificate_validity_days'), '1');
update public.platform_settings set value='365' where key='seal_certificate_validity_days';

select '=== 23. Ranking de indicadores';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'indicadores calculados: ' || public.admin_recalculate_referrer_ranking();
select pg_temp.expect_eq('recalcular sem mudança não duplica', public.admin_recalculate_referrer_ranking()::text, '0');
reset role;
select 'ranking: ' || p.full_name || ' => ' || coalesce(t.name,'sem nível') || ' ' || r.points || ' pts ' || r.metrics::text
  from (select distinct on (user_id) * from public.referrer_rankings order by user_id, id desc) r
  join public.profiles p on p.id = r.user_id left join public.referrer_tiers t on t.code = r.tier_code order by r.points desc;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select 'minha situação: ' || tier_name || ' | ' || points || ' pts | posição ' || position || ' de ' || total || ' | próximo ' || coalesce(next_tier_name,'-') || ' faltam ' || coalesce(points_to_next,0) from public.indicator_my_ranking;
select pg_temp.expect_eq('placar não mostra nome de quem não aceitou', (select count(*)::text from public.referrer_leaderboard where display_name <> 'Indicador anônimo'), '0');
select public.indicator_set_ranking_opt_in(true);
select pg_temp.expect_eq('após aceitar, o nome aparece reduzido', (select display_name from public.referrer_leaderboard where is_me), 'Marina S.');
select pg_temp.expect_fail('indicador muda a própria pontuação', $$update public.referrer_rankings set points = 99999$$);
select pg_temp.expect_fail('indicador lê ranking de todos', $$select count(*) from public.referrer_ranking_latest$$);
select pg_temp.expect_fail('indicador edita nível', $$select public.admin_save_referrer_tier('nivel1','Rei',1,0,true)$$);
select pg_temp.expect_fail('indicador cria benefício', $$select public.admin_save_referrer_benefit(null,'nivel1','Brinde',null,true)$$);
select pg_temp.expect_fail('indicador recalcula ranking', $$select public.admin_recalculate_referrer_ranking()$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false); set role authenticated;
select pg_temp.expect_eq('Rafael só vê a própria linha em "minha situação"', (select count(*)::text from public.indicator_my_ranking where user_id = '00000000-0000-0000-0000-0000000000b2'), (select count(*)::text from public.indicator_my_ranking));
reset role;

select '=== 24. Benefícios por nível';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_save_referrer_benefit(null,'nivel1','Selo de indicador no perfil','Aparece no seu painel.',true);
select public.admin_save_referrer_benefit(null,'nivel5','Brinde anual','A definir.',true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false); set role authenticated;
select pg_temp.expect_eq('indicador de nível baixo vê só os benefícios do seu nível', (select count(*)::text from public.indicator_benefits), '1');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_save_referrer_criterion('closed_referrals', 100, null, true);
select public.admin_recalculate_referrer_ranking();
reset role;
select 'peso alterado: ' || points from (select distinct on (user_id) * from public.referrer_rankings where user_id='00000000-0000-0000-0000-0000000000b1' order by user_id, id desc) x;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_save_referrer_criterion('closed_referrals', 10, null, true);
select public.admin_recalculate_referrer_ranking();
reset role;
select pg_temp.expect_fail('apagar nível do ranking', $$delete from public.referrer_tiers where code='nivel1'$$);
select pg_temp.expect_fail('apagar benefício', $$delete from public.referrer_benefits$$);
