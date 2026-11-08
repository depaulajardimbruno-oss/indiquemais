-- Empresas e acessos pelo admin. Roda depois de company_panel.sql. Só em banco de teste.
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

select '=== 38. Admin cadastra empresa';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select pg_temp.expect_fail('CNPJ inválido', $$select public.admin_create_company('Vidraçaria X','VIDRACARIA X LTDA','11.222.333/0001-82')$$);
select public.admin_create_company('Vidraçaria X','VIDRACARIA X LTDA','11.222.333/0001-81','pequena','intermediario') as cx \gset
select pg_temp.expect_eq('empresa nasce no plano escolhido', (select plan_code from public.admin_companies where id = :'cx'), 'intermediario');
select pg_temp.expect_fail('CNPJ repetido', $$select public.admin_create_company('Outra','OUTRA LTDA','11222333000181')$$);
select pg_temp.expect_eq('aparece na lista do admin', (select name || '|' || plan_name || '|' || members_count from public.admin_companies where id = :'cx'), 'Vidraçaria X|Intermediário|0');
select public.admin_update_company_legal(:'cx','VIDRACARIA X EIRELI','11.444.777/0001-61','ativa','media');
select pg_temp.expect_eq('dados legais corrigidos', (select legal_name || '|' || cnpj || '|' || customer_group from public.admin_companies where id = :'cx'), 'VIDRACARIA X EIRELI|11444777000161|media');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select pg_temp.expect_fail('empresa cadastra empresa', $$select public.admin_create_company('Y','Y LTDA','12345678000195')$$);
select pg_temp.expect_fail('empresa altera CNPJ', format($$select public.admin_update_company_legal(%L,'X','12345678000195','ativa',null)$$, 'c0000000-0000-0000-0000-000000000001'));
select pg_temp.expect_eq('empresa não vê lista do admin', (select count(*)::text from public.admin_companies), '0');
reset role;

select '=== 39. Liberar acesso a um login';
-- e-mail sem conta: gera convite
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select token as t1 from public.company_grant_access(:'cx','Responsavel@VidracariaX.com','admin') \gset
select pg_temp.expect_eq('sem conta: gera convite', (length(:'t1') = 16)::text, 'true');
select pg_temp.expect_eq('liberar de novo reaproveita o convite', (select token from public.company_grant_access(:'cx','responsavel@vidracariax.com','admin')), :'t1');
select pg_temp.expect_eq('convite aparece na equipe', (select kind || '|' || email from public.company_team where company_id = :'cx'), 'convite|responsavel@vidracariax.com');
reset role;
set role anon;
select pg_temp.expect_eq('página do convite mostra empresa e e-mail', (select company_name || '|' || email || '|' || valid::text from public.access_invite_info(:'t1')), 'Vidraçaria X|responsavel@vidracariax.com|true');
reset role;
-- outra pessoa tenta aceitar
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false); set role authenticated;
select pg_temp.expect_fail('aceitar com outro e-mail', format($$select public.accept_access_invite(%L)$$, :'t1'));
reset role;
-- dono do e-mail cria conta e aceita
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000e1','responsavel@vidracariax.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false); set role authenticated;
select pg_temp.expect_eq('aceita e vira admin da empresa', (public.accept_access_invite(:'t1') = :'cx')::text, 'true');
select pg_temp.expect_eq('vê a empresa no painel com papel admin', (select my_role from public.company_my_companies where id = :'cx'), 'admin');
select pg_temp.expect_eq('aceitar de novo não quebra', (public.accept_access_invite(:'t1') = :'cx')::text, 'true');
-- o admin da empresa libera um operador que já tem conta
select pg_temp.expect_eq('e-mail com conta: vincula na hora', (select status from public.company_grant_access(:'cx','operador@soulglass.com','operador')), 'vinculado');
select pg_temp.expect_eq('equipe com 2 membros', (select count(*)::text from public.company_team where company_id = :'cx' and kind = 'membro'), '2');
select pg_temp.expect_fail('rebaixar o único admin', $$select public.company_set_member_role('$$ || :'cx' || $$','00000000-0000-0000-0000-0000000000e1','operador')$$);
select pg_temp.expect_fail('remover o único admin', $$select public.company_revoke_access('$$ || :'cx' || $$','00000000-0000-0000-0000-0000000000e1')$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false); set role authenticated;
select pg_temp.expect_fail('operador libera acesso', format($$select * from public.company_grant_access(%L,'x@y.com','admin')$$, :'cx'));
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false); set role authenticated;
select public.company_revoke_access(:'cx','00000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_eq('operador removido', (select count(*)::text from public.company_team where company_id = :'cx' and kind = 'membro'), '1');
reset role;
select pg_temp.expect_eq('remoção registrada na auditoria', (select count(*)::text from public.audit_log where action = 'REMOVE_ACESSO'), '1');
set role anon;
select pg_temp.expect_eq('convite aceito não vale mais', (select valid::text from public.access_invite_info(:'t1')), 'false');
reset role;
-- limite de usuários do plano (intermediário = 2)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false); set role authenticated;
select public.company_grant_access(:'cx','operador@soulglass.com','operador');
select pg_temp.expect_fail('passar do limite de usuários do plano', format($$select * from public.company_grant_access(%L,'maria@email.com','operador')$$, :'cx'));
reset role;
