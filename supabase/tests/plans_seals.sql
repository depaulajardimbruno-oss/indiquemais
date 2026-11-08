-- Planos e selos. Roda DEPOIS de security_smoke.sql (usa os mesmos dados). Só em banco de teste.
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

select '=== 14. Planos: leitura e escrita';
set role anon;
select pg_temp.expect_eq('visitante vê 3 planos ativos (Avançado+ reservado)', (select count(*)::text from public.plans), '3');
select pg_temp.expect_eq('planos à venda', (select string_agg(name || ':' || monthly_price_cents || ':' || commitment_months || ':' || platform_fee_bps, ' ' order by sort_order) from public.plans), 'Mensal:39700:1:100 Semestral:29700:6:80 Anual:19700:12:60');
select pg_temp.expect_fail('visitante lê histórico de planos', 'select * from public.company_plan_history');
select pg_temp.expect_fail('visitante grava plano', $$update public.plans set platform_fee_bps = 0$$);
reset role;
-- Fixture: limites apertados só no banco de teste, para provar que os limites do plano são aplicados.
update public.plans set max_active_referrers = 10, max_offers = 3, max_members = 1 where code = 'inicial';
update public.plans set max_active_referrers = 50, max_offers = 10, max_members = 2 where code = 'intermediario';

-- Casa Nova (operador a2) começa no Inicial
select pg_temp.expect_eq('Casa Nova nasce no plano inicial', public.company_plan_code('c0000000-0000-0000-0000-000000000002'), 'inicial');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select pg_temp.expect_fail('empresa muda o próprio plano', $$select public.admin_set_company_plan('c0000000-0000-0000-0000-000000000002','avancado_mais')$$);
select pg_temp.expect_fail('empresa edita plano', $$select public.admin_save_plan('inicial','X',null,1,0,0,null,null,null,'basico',false,false,'email',true)$$);
select pg_temp.expect_fail('empresa grava nível de selo', $$select public.admin_save_seal_level('ouro','Ouro',3,0,0,true)$$);
select pg_temp.expect_fail('empresa recalcula selos', $$select public.admin_recalculate_seals()$$);
select pg_temp.expect_fail('empresa grava direto na tabela de planos', $$update public.plans set active=false$$);
select 'empresa vê o próprio plano: ' || plan_name || ' | produtos ' || used_offers || '/' || max_offers from public.company_current_plan;

select '=== 15. Limites do plano Inicial (3 produtos, 1 usuário)';
select public.company_save_offer('c0000000-0000-0000-0000-000000000002', null, 'Produto B', null, 1000, null, null, 0, true);
select public.company_save_offer('c0000000-0000-0000-0000-000000000002', null, 'Produto C', null, 1000, null, null, 0, true);
select pg_temp.expect_fail('4º produto no plano Inicial', $$select public.company_save_offer('c0000000-0000-0000-0000-000000000002', null, 'Produto D', null, 1000, null, null, 0, true)$$);
reset role;
select pg_temp.expect_fail('2º usuário no plano Inicial', $$insert into public.company_members values ('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1','operador')$$);

select '=== 16. Administrador troca de plano';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.admin_set_company_plan('c0000000-0000-0000-0000-000000000002','intermediario','Teste');
reset role;
select pg_temp.expect_eq('plano atual', public.company_plan_code('c0000000-0000-0000-0000-000000000002'), 'intermediario');
select pg_temp.expect_eq('taxa da empresa acompanha o plano (80)', (select platform_fee_bps::text from public.companies where id='c0000000-0000-0000-0000-000000000002'), '80');
select pg_temp.expect_eq('histórico: 2 linhas, 1 aberta', (select count(*)||'/'||count(*) filter (where ends_at is null) from public.company_plan_history where company_id='c0000000-0000-0000-0000-000000000002'), '2/1');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select public.company_save_offer('c0000000-0000-0000-0000-000000000002', null, 'Produto D', null, 1000, null, null, 0, true);
select public.company_save_offer('c0000000-0000-0000-0000-000000000002', null, 'Produto E', null, 1000, null, null, 0, true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('voltar ao Inicial com 5 produtos ativos', $$select public.admin_set_company_plan('c0000000-0000-0000-0000-000000000002','inicial')$$);
select public.admin_save_plan('avancado','Avançado',null,3,null,60,200,null,5,'completo',true,false,'whatsapp',false);
select pg_temp.expect_fail('contratar plano desativado', $$select public.admin_set_company_plan('c0000000-0000-0000-0000-000000000002','avancado')$$);
select public.admin_save_plan('avancado','Avançado',null,3,null,60,200,null,5,'completo',true,false,'whatsapp',true);
select public.admin_set_company_plan('c0000000-0000-0000-0000-000000000002','avancado');
reset role;
select pg_temp.expect_eq('plano reativado e contratado', public.company_plan_code('c0000000-0000-0000-0000-000000000002'), 'avancado');
select pg_temp.expect_fail('apagar plano', $$delete from public.plans where code='inicial'$$);
select pg_temp.expect_fail('apagar histórico de plano', $$delete from public.company_plan_history$$);
select pg_temp.expect_fail('alterar taxa do histórico', $$update public.company_plan_history set platform_fee_bps = 0$$);
select pg_temp.expect_fail('reabrir período encerrado', $$update public.company_plan_history set ends_at = null where ends_at is not null$$);
select pg_temp.expect_eq('auditoria registra mudança de plano', (select (count(*) > 0)::text from public.audit_log where table_name='company_plan_history' and action='INSERT'), 'true');

select '=== 17. Taxa por plano vigente na venda';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'Soulglass vendas ' || sales_cents || ' taxa ' || fee_cents || ' (plano a 0,5%)' from public.company_platform_fees where company_id='c0000000-0000-0000-0000-000000000001';
select pg_temp.expect_eq('taxa = 0,5% das vendas', (select fee_cents::text from public.company_platform_fees where company_id='c0000000-0000-0000-0000-000000000001'),
                         (select round(sales_cents * 0.005)::bigint::text from public.company_platform_fees where company_id='c0000000-0000-0000-0000-000000000001'));
reset role;

select '=== 18. Selos';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select 'selos recalculados: ' || public.admin_recalculate_seals();
select company_name || ' => ' || coalesce(level_name,'sem selo') || ' (' || score || ' pts) ' || metrics::text from (
  select c.name as company_name, s.level_name, s.score, s.metrics from public.company_seal_current s join public.companies c on c.id = s.company_id) x order by 1;
reset role;
select pg_temp.expect_eq('toda empresa ativa tem selo', (select count(*)::text from public.company_seals where level_code is not null), '2');

select '=== 19. Selos parametrizados';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_eq('recalcular sem mudança não duplica', public.admin_recalculate_seals()::text, '0');
-- Soulglass: 3 vendas*10 + 1 confirmação*15 = 45 pts. Subir o peso das vendas muda a pontuação.
select public.admin_save_seal_criterion('closed_sales', 40, null, true);
select public.admin_recalculate_seals();
select pg_temp.expect_eq('peso novo: 3*40 + 15 = 135 pts', (select score::text from public.company_seal_current where company_id='c0000000-0000-0000-0000-000000000001'), '135');
select pg_temp.expect_eq('135 pts mas só 3 vendas (<5): continua Bronze', (select level_name from public.company_seal_current where company_id='c0000000-0000-0000-0000-000000000001'), 'Bronze');
select public.admin_save_seal_level('prata','Prata',2,100,3,true);
select public.admin_recalculate_seals();
select pg_temp.expect_eq('Prata com mínimo de 3 vendas', (select level_name from public.company_seal_current where company_id='c0000000-0000-0000-0000-000000000001'), 'Prata');
select public.admin_save_seal_level('prata','Prata',2,100,3,false);
select public.admin_recalculate_seals();
select pg_temp.expect_eq('nível desativado é pulado (volta ao Bronze)', (select level_name from public.company_seal_current where company_id='c0000000-0000-0000-0000-000000000001'), 'Bronze');
select public.admin_save_seal_criterion('closed_sales', 40, null, false);
select public.admin_recalculate_seals();
select pg_temp.expect_eq('critério desativado não pontua (só 15)', (select score::text from public.company_seal_current where company_id='c0000000-0000-0000-0000-000000000001'), '15');
select pg_temp.expect_fail('critério inexistente', $$select public.admin_save_seal_criterion('inventado', 1, null, true)$$);
-- volta ao padrão
select public.admin_save_seal_criterion('closed_sales', 10, null, true);
select public.admin_save_seal_level('prata','Prata',2,100,5,true);
select public.admin_recalculate_seals();
reset role;
select pg_temp.expect_eq('histórico de selos guarda cada mudança', (select (count(*) >= 5)::text from public.company_seals where company_id='c0000000-0000-0000-0000-000000000001'), 'true');
select pg_temp.expect_eq('desde quando é Bronze não muda se o nível é o mesmo',
   (select (count(distinct level_since) filter (where level_code='bronze') <= 2)::text from public.company_seals where company_id='c0000000-0000-0000-0000-000000000001'), 'true');
select pg_temp.expect_fail('alterar registro de selo', $$update public.company_seals set score = 9999$$);
select pg_temp.expect_fail('apagar registro de selo', $$delete from public.company_seals$$);
select pg_temp.expect_fail('apagar nível', $$delete from public.seal_levels where code='bronze'$$);

select '=== 20. Verificação pública do selo';
set role anon;
select 'público vê: ' || company_name || ' => ' || level_name from public.public_company_seals order by 1;
select pg_temp.expect_fail('visitante lê pontuação', 'select score from public.company_seals');
select pg_temp.expect_fail('visitante lê métricas pelo view de empresa', 'select score from public.company_seal_current');
select pg_temp.expect_eq('visitante vê níveis ativos', (select count(*)::text from public.seal_levels), '5');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select pg_temp.expect_eq('empresa só vê o próprio selo', (select count(*)::text from public.company_seal_current), '1');
reset role;
