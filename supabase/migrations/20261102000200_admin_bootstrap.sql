-- Pré-autoriza e-mails de administradores do Indiki+.
-- A pessoa vira admin sozinha na primeira vez que entra e CONFIRMA o e-mail (link mágico).
-- Ninguém consegue se promover sem ter acesso à caixa de entrada.

create table if not exists public.platform_admin_invites (
  email       text primary key check (email = lower(btrim(email))),
  created_at  timestamptz not null default now()
);
alter table public.platform_admin_invites enable row level security;
revoke all on public.platform_admin_invites from anon, authenticated;

drop trigger if exists trg_no_delete on public.platform_admin_invites;
create trigger trg_no_delete before delete on public.platform_admin_invites
  for each row execute function public.forbid_delete();

create or replace function public.grant_invited_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.platform_admin_invites where email = lower(btrim(new.email))) then
    insert into public.profiles (id, full_name)
    values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
    insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return null;
end $$;
revoke all on function public.grant_invited_admin() from public, anon, authenticated;

-- Nome começa com "zz" para rodar depois da criação do perfil.
drop trigger if exists zz_grant_invited_admin on auth.users;
create trigger zz_grant_invited_admin after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_invited_admin();

insert into public.platform_admin_invites (email) values ('depaulajardim.bruno@gmail.com')
on conflict do nothing;
