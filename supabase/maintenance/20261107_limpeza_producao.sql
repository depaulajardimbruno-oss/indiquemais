-- Limpeza da produção antes de começar a usar de verdade (07/11/2026).
-- Mantém: a conta do admin (depaulajardim.bruno@gmail.com) e todas as configurações (planos, selos, níveis, regras, marca).
-- Apaga: o usuário de teste bru.no1@hotmail.com (perfil + conta) e o histórico de auditoria de teste.
-- Antes disto, o banco não tinha empresas, produtos, indicações, comissões nem faturas.
begin;
alter table public.profiles disable trigger user;
delete from public.profiles
 where id <> (select user_id from public.platform_admins limit 1)
   and id not in (select user_id from public.platform_admins);
alter table public.profiles enable trigger user;
delete from auth.users
 where id not in (select user_id from public.platform_admins);
truncate public.audit_log;
commit;
