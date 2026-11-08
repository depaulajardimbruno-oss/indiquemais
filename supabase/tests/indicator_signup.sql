-- Convite da empresa + cadastro completo do indicador. Roda depois de rule_snapshot.sql. Só em banco de teste.
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

select '=== 32. Convite da empresa';
-- empresa 1 (Soulglass) pega o link
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select token as tk1 from public.company_invite_get('c0000000-0000-0000-0000-000000000001') \gset
select pg_temp.expect_eq('link do convite tem 10 caracteres', length(:'tk1')::text, '10');
select pg_temp.expect_eq('pedir de novo devolve o mesmo link', (select token from public.company_invite_get('c0000000-0000-0000-0000-000000000001')), :'tk1');
select pg_temp.expect_fail('empresa pega o link de outra empresa', $$select * from public.company_invite_get('c0000000-0000-0000-0000-000000000002')$$);
select pg_temp.expect_fail('empresa lê a tabela de convites', $$select * from public.company_invites$$);
reset role;

-- visitante vê só o nome da empresa
set role anon;
select pg_temp.expect_eq('visitante vê a empresa do link', (select company_name || '/' || valid::text from public.invite_info(:'tk1')), 'Soulglass/true');
select pg_temp.expect_eq('link inexistente não devolve nada', (select count(*)::text from public.invite_info('XXXXXXXXXX')), '0');
select pg_temp.expect_fail('visitante cadastra indicador', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
reset role;

select '=== 33. Cadastro completo pelo link';
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000c1','maria@email.com',now()),
  ('00000000-0000-0000-0000-0000000000c2','joao@email.com',null),
  ('00000000-0000-0000-0000-0000000000c3','outra@email.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false); set role authenticated;
select pg_temp.expect_fail('e-mail ainda não confirmado', format($$select public.indicator_register(%L,'João Pedro Alves','(19) 99999-0002','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated;
select pg_temp.expect_fail('só um nome', format($$select public.indicator_register(%L,'Maria','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('menor de idade', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001',(current_date - interval '16 years')::date,'Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('CPF em branco sem cadastro anterior', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('CPF inválido', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','11111111111','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('telefone sem DDD', format($$select public.indicator_register(%L,'Maria Souza Lima','99999','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('sem aceitar termos', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',false)$$, :'tk1'));
select pg_temp.expect_fail('PIX telefone curto', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','telefone','123','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('PIX sem tipo', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','xyz','abc','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('link inválido', $$select public.indicator_register('ZZZZZZZZZZ','Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true)$$);
select public.indicator_register(:'tk1','Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','123.456.789-09','cpf','123.456.789-09','cliente','v1',true) as cod1 \gset
reset role;
select pg_temp.expect_eq('código gerado com o primeiro nome', (:'cod1' ~ '^MARIA-[A-Z0-9]{4}$')::text, 'true');
select pg_temp.expect_eq('vínculo criado na Soulglass, ativo e ligado ao convite', (select (company_id = 'c0000000-0000-0000-0000-000000000001' and active and invite_id is not null and user_id = '00000000-0000-0000-0000-0000000000c1')::text from public.referrer_links where code = :'cod1'), 'true');
select pg_temp.expect_eq('perfil completo gravado', (select (registration_completed_at is not null and city = 'Campinas' and state = 'SP' and pix_key = '12345678909' and terms_version = 'v1')::text from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 'true');
select pg_temp.expect_eq('CPF guardado só com números', (select cpf from public.indicator_tax_profiles where user_id = '00000000-0000-0000-0000-0000000000c1'), '12345678909');

-- repetir não duplica
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated;
select pg_temp.expect_eq('repetir o cadastro devolve o mesmo código', public.indicator_register(:'tk1','Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true), :'cod1');
select pg_temp.expect_eq('ela vê o próprio cadastro com CPF mascarado', (select cpf_masked from public.indicator_my_profile), '***.456.***-09');
select pg_temp.expect_eq('e vê o vínculo em "meus vínculos"', (select count(*)::text from public.indicator_links), '1');
reset role;
select pg_temp.expect_eq('um só vínculo no banco', (select count(*)::text from public.referrer_links where user_id = '00000000-0000-0000-0000-0000000000c1' and company_id = 'c0000000-0000-0000-0000-000000000001'), '1');

-- outra pessoa com o mesmo CPF
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false); set role authenticated;
select pg_temp.expect_fail('mesmo CPF em outra conta', format($$select public.indicator_register(%L,'Outra Pessoa Silva','(11) 98888-0000','1991-01-01','São Paulo','SP','12345678909','cpf','12345678909','cliente','v1',true)$$, :'tk1'));
select pg_temp.expect_fail('mesmo telefone já cadastrado na empresa', format($$select public.indicator_register(%L,'Outra Pessoa Silva','(19) 99999-0001','1991-01-01','São Paulo','SP','11144477735','cpf','11144477735','cliente','v1',true)$$, :'tk1'));
reset role;

select '=== 34. Várias empresas, cadastro prévio, pausar e renovar';
-- Maria entra também na Casa Nova: só o vínculo é criado
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select token as tk2 from public.company_invite_get('c0000000-0000-0000-0000-000000000002') \gset
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated;
select public.indicator_register(:'tk2','Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true) as cod2 \gset
select pg_temp.expect_eq('CPF em branco mantém o já cadastrado', (public.indicator_register(:'tk2','Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','','cpf','12345678909','cliente','v1',true) = :'cod2')::text, 'true');
select pg_temp.expect_eq('mesma pessoa, segunda empresa: 2 vínculos', (select count(*)::text from public.indicator_links), '2');
select pg_temp.expect_eq('códigos diferentes por empresa', (:'cod1' <> :'cod2')::text, 'true');
reset role;

-- empresa já tinha cadastrado o cliente à mão (mesmo e-mail): o convite adota o cadastro em vez de duplicar
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false); set role authenticated;
select public.company_register_indicator('c0000000-0000-0000-0000-000000000002','Carlos Prévio','carlos@email.com','(19) 97777-0003') as cprev \gset
reset role;
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000c4','carlos@email.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c4',false); set role authenticated;
select pg_temp.expect_eq('convite adota o cadastro prévio (mesmo código)', public.indicator_register(:'tk2','Carlos Eduardo Prévio','(19) 97777-0003','1985-03-03','Campinas','SP','86288366757','cpf','86288366757','profissional','v1',true), :'cprev');
reset role;
select pg_temp.expect_eq('sem duplicar na Casa Nova', (select count(*)::text from public.referrer_links where company_id = 'c0000000-0000-0000-0000-000000000002' and (email = 'carlos@email.com')), '1');

-- pausar o convite
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_invite_set_active('c0000000-0000-0000-0000-000000000001', false);
reset role;
set role anon;
select pg_temp.expect_eq('link pausado aparece como inválido', (select valid::text from public.invite_info(:'tk1')), 'false');
reset role;
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000c5','novo@email.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c5',false); set role authenticated;
select pg_temp.expect_fail('cadastro por link pausado', format($$select public.indicator_register(%L,'Novo Cliente Teste','(19) 96666-0004','1992-02-02','Campinas','SP','15350946056','cpf','15350946056','cliente','v1',true)$$, :'tk1'));
reset role;

-- renovar: o antigo morre, o novo vale
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_invite_rotate('c0000000-0000-0000-0000-000000000001') as tk3 \gset
select pg_temp.expect_eq('novo link é diferente', (:'tk3' <> :'tk1')::text, 'true');
select pg_temp.expect_eq('empresa vê o novo link e 1 cadastro', (select token || '/' || joined from public.company_invite_get('c0000000-0000-0000-0000-000000000001')), :'tk3' || '/1');
reset role;
set role anon;
select pg_temp.expect_eq('link antigo segue inválido', (select valid::text from public.invite_info(:'tk1')), 'false');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c5',false); set role authenticated;
select pg_temp.expect_eq('link novo funciona', (public.indicator_register(:'tk3','Novo Cliente Teste','(19) 96666-0004','1992-02-02','Campinas','SP','15350946056','cpf','15350946056','cliente','v1',true) ~ '^NOVO-')::text, 'true');
reset role;
select pg_temp.expect_eq('quem entrou pelo link antigo continua vinculado', (select count(*)::text from public.referrer_links where code = :'cod1' and active), '1');

-- pausar o indicador na empresa: não consegue se recadastrar pelo mesmo link
select id as lk1 from public.referrer_links where code = :'cod1' \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false); set role authenticated;
select public.company_invite_set_active('c0000000-0000-0000-0000-000000000001', true);
select public.company_set_indicator_active(:'lk1', false);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated;
select pg_temp.expect_fail('indicador pausado tenta voltar pelo link', format($$select public.indicator_register(%L,'Maria Souza Lima','(19) 99999-0001','1990-05-10','Campinas','SP','12345678909','cpf','12345678909','cliente','v1',true)$$, :'tk3'));
reset role;
