-- =====================================================================
-- Indiki+  |  Empresas e acessos pelo admin (v1)
--
--  - O admin do Indiki+ cadastra a empresa pela tela (nome, razão social, CNPJ, grupo, plano).
--  - "Liberar acesso": liga um login (e-mail) à empresa como administrador ou operador.
--      * Se o e-mail já tem conta: vira membro na hora.
--      * Se não tem: gera um CONVITE DE ACESSO (link /acesso/TOKEN). A pessoa cria a conta
--        com senha (ou entra) e aceita; só funciona com o mesmo e-mail do convite.
--  - O administrador da empresa também pode liberar acesso para a própria equipe.
--  - Remover acesso apaga o vínculo (fica registrado na auditoria) e nunca o último administrador.
-- =====================================================================

-- CNPJ com dígitos verificadores.
create or replace function public.is_valid_cnpj(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare c text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
        w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2]; s int; d int; i int;
begin
  if length(c) <> 14 or c ~ '^(\d)\1{13}$' then return false; end if;
  s := 0; for i in 1..12 loop s := s + substr(c, i, 1)::int * w1[i]; end loop;
  d := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  if d <> substr(c, 13, 1)::int then return false; end if;
  s := 0; for i in 1..13 loop s := s + substr(c, i, 1)::int * w2[i]; end loop;
  d := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return d = substr(c, 14, 1)::int;
end $$;

-- ---------------------------------------------------------------------
-- ADMIN: cadastrar empresa e corrigir dados legais
-- ---------------------------------------------------------------------
create or replace function public.admin_create_company(
  p_name text, p_legal_name text, p_cnpj text, p_group text default null, p_plan text default 'inicial'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'); v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Informe o nome da empresa.'; end if;
  if length(btrim(coalesce(p_legal_name, ''))) < 3 then raise exception 'Informe a razão social.'; end if;
  if not public.is_valid_cnpj(v_cnpj) then raise exception 'CNPJ inválido. Confira os números.'; end if;
  if exists (select 1 from public.companies where cnpj = v_cnpj) then raise exception 'Já existe empresa com este CNPJ.'; end if;
  if p_group is not null and not exists (select 1 from public.customer_groups where code = p_group and active) then
    raise exception 'Grupo de cliente inexistente.';
  end if;
  insert into public.companies (name, legal_name, cnpj, customer_group)
  values (btrim(p_name), btrim(p_legal_name), v_cnpj, p_group) returning id into v_id;
  if coalesce(p_plan, 'inicial') <> 'inicial' then
    perform public.admin_set_company_plan(v_id, p_plan, 'Plano definido no cadastro');
  end if;
  return v_id;
end $$;

create or replace function public.admin_update_company_legal(
  p_company uuid, p_legal_name text, p_cnpj text, p_status text, p_group text
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
begin
  if not public.is_platform_admin() then raise exception 'Apenas o administrador do Indiki+.' using errcode = 'insufficient_privilege'; end if;
  if length(btrim(coalesce(p_legal_name, ''))) < 3 then raise exception 'Informe a razão social.'; end if;
  if not public.is_valid_cnpj(v_cnpj) then raise exception 'CNPJ inválido. Confira os números.'; end if;
  if exists (select 1 from public.companies where cnpj = v_cnpj and id <> p_company) then raise exception 'Já existe outra empresa com este CNPJ.'; end if;
  if p_status not in ('ativa', 'suspensa') then raise exception 'Situação inválida.'; end if;
  if p_group is not null and not exists (select 1 from public.customer_groups where code = p_group and active) then
    raise exception 'Grupo de cliente inexistente.';
  end if;
  update public.companies set legal_name = btrim(p_legal_name), cnpj = v_cnpj, status = p_status, customer_group = p_group, updated_at = now()
   where id = p_company and archived_at is null;
  if not found then raise exception 'Empresa não encontrada.'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Convites de acesso à empresa (equipe)
-- ---------------------------------------------------------------------
create table if not exists public.company_member_invites (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete restrict,
  email        text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         public.member_role not null default 'admin',
  token        text not null unique check (token ~ '^[A-Z0-9]{12,20}$'),
  created_by   uuid references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id) on delete restrict,
  revoked_at   timestamptz
);
create unique index if not exists uq_member_invite_pending on public.company_member_invites (company_id, email)
  where accepted_at is null and revoked_at is null;
alter table public.company_member_invites enable row level security;
revoke all on public.company_member_invites from anon, authenticated;
drop trigger if exists trg_no_delete on public.company_member_invites;
create trigger trg_no_delete before delete on public.company_member_invites for each row execute function public.forbid_delete();

-- O vínculo de equipe pode ser removido (só pelas funções abaixo), com registro na auditoria.
drop trigger if exists trg_no_delete on public.company_members;

-- Membros ativos da empresa (para limite de plano e "último administrador").
create or replace function public.gen_member_invite_token() returns text
language plpgsql volatile set search_path = '' as $$
declare v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; v_t text; i int;
begin
  loop
    v_t := '';
    for i in 1..16 loop v_t := v_t || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1); end loop;
    exit when not exists (select 1 from public.company_member_invites where token = v_t);
  end loop;
  return v_t;
end $$;
revoke all on function public.gen_member_invite_token() from public, anon, authenticated;

-- Liberar acesso: devolve 'vinculado' (já tinha conta) ou o token do convite.
create or replace function public.company_grant_access(p_company uuid, p_email text, p_role text default 'admin')
returns table (status text, token text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_user uuid; v_tok text;
begin
  if not public.is_company_admin(p_company) then
    raise exception 'Só o administrador da empresa ou do Indiki+ libera acessos.' using errcode = 'insufficient_privilege';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if p_role not in ('admin', 'operador') then raise exception 'Papel inválido.'; end if;
  if not exists (select 1 from public.companies where id = p_company and archived_at is null) then raise exception 'Empresa não encontrada.'; end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;
  if v_user is not null then
    insert into public.profiles (id, full_name) values (v_user, split_part(v_email, '@', 1)) on conflict (id) do nothing;
    if exists (select 1 from public.company_members where company_id = p_company and user_id = v_user) then
      update public.company_members set role = p_role::public.member_role where company_id = p_company and user_id = v_user;
    else
      insert into public.company_members (company_id, user_id, role) values (p_company, v_user, p_role::public.member_role);
    end if;
    update public.company_member_invites set revoked_at = now()
     where company_id = p_company and email = v_email and accepted_at is null and revoked_at is null;
    return query select 'vinculado'::text, null::text;
    return;
  end if;

  -- Sem conta: reaproveita o convite pendente (renovando o prazo) ou cria um novo.
  select i.token into v_tok from public.company_member_invites i
   where i.company_id = p_company and i.email = v_email and i.accepted_at is null and i.revoked_at is null;
  if v_tok is not null then
    update public.company_member_invites set role = p_role::public.member_role, expires_at = now() + interval '14 days'
     where token = v_tok;
  else
    v_tok := public.gen_member_invite_token();
    insert into public.company_member_invites (company_id, email, role, token, created_by)
    values (p_company, v_email, p_role::public.member_role, v_tok, auth.uid());
  end if;
  return query select 'convite'::text, v_tok;
end $$;

-- Remover acesso (nunca o último administrador).
create or replace function public.company_revoke_access(p_company uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.company_members;
begin
  if not public.is_company_admin(p_company) then
    raise exception 'Só o administrador da empresa ou do Indiki+ remove acessos.' using errcode = 'insufficient_privilege';
  end if;
  select * into m from public.company_members where company_id = p_company and user_id = p_user for update;
  if not found then raise exception 'Este login não tem acesso à empresa.'; end if;
  if m.role = 'admin' and (select count(*) from public.company_members where company_id = p_company and role = 'admin') = 1 then
    raise exception 'Não dá para remover o último administrador da empresa. Libere outro administrador antes.';
  end if;
  delete from public.company_members where company_id = p_company and user_id = p_user;
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
  values ('company_members', p_company::text || '/' || p_user::text, 'REMOVE_ACESSO', to_jsonb(m), null, auth.uid());
end $$;

-- Mudar papel (nunca rebaixar o último administrador).
create or replace function public.company_set_member_role(p_company uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_company_admin(p_company) then
    raise exception 'Só o administrador da empresa ou do Indiki+ muda papéis.' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('admin', 'operador') then raise exception 'Papel inválido.'; end if;
  if p_role = 'operador' and (select role from public.company_members where company_id = p_company and user_id = p_user) = 'admin'
     and (select count(*) from public.company_members where company_id = p_company and role = 'admin') = 1 then
    raise exception 'A empresa precisa de pelo menos um administrador.';
  end if;
  update public.company_members set role = p_role::public.member_role where company_id = p_company and user_id = p_user;
  if not found then raise exception 'Este login não tem acesso à empresa.'; end if;
end $$;

create or replace function public.company_cancel_access_invite(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  select company_id into v_company from public.company_member_invites where token = p_token and accepted_at is null and revoked_at is null;
  if v_company is null then raise exception 'Convite não encontrado ou já usado.'; end if;
  if not public.is_company_admin(v_company) then raise exception 'Sem permissão.' using errcode = 'insufficient_privilege'; end if;
  update public.company_member_invites set revoked_at = now() where token = p_token;
end $$;

-- PÚBLICO: o que aparece em /acesso/TOKEN.
create or replace function public.access_invite_info(p_token text)
returns table (company_name text, email text, role text, valid boolean)
language sql stable security definer set search_path = '' as $$
  select c.name, i.email, i.role::text,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now() and c.archived_at is null)
    from public.company_member_invites i
    join public.companies c on c.id = i.company_id
   where i.token = upper(btrim(coalesce(p_token, '')))
$$;

-- Logado com o MESMO e-mail do convite: aceita e vira membro.
create or replace function public.accept_access_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.company_member_invites; v_email text; v_conf timestamptz;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.' using errcode = 'insufficient_privilege'; end if;
  select * into i from public.company_member_invites where token = upper(btrim(coalesce(p_token, ''))) for update;
  if not found or i.revoked_at is not null then raise exception 'Este convite não existe ou foi cancelado.'; end if;
  if i.accepted_at is not null then
    if i.accepted_by = auth.uid() then return i.company_id; end if;
    raise exception 'Este convite já foi usado.';
  end if;
  if i.expires_at <= now() then raise exception 'Este convite venceu. Peça um novo ao Indiki+.'; end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_conf from auth.users u where u.id = auth.uid();
  if v_email <> i.email then raise exception 'Este convite é para %. Entre com esse e-mail.', i.email; end if;
  if v_conf is null then raise exception 'Confirme o seu e-mail antes de continuar.'; end if;
  insert into public.profiles (id, full_name) values (auth.uid(), split_part(v_email, '@', 1)) on conflict (id) do nothing;
  insert into public.company_members (company_id, user_id, role) values (i.company_id, auth.uid(), i.role)
  on conflict (company_id, user_id) do update set role = excluded.role;
  update public.company_member_invites set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return i.company_id;
end $$;

-- ---------------------------------------------------------------------
-- Visões
-- ---------------------------------------------------------------------
-- Equipe da empresa: membros e convites pendentes.
drop view if exists public.company_team;
create view public.company_team as
select m.company_id, m.user_id, u.email, p.full_name, m.role::text as role, m.created_at, 'membro'::text as kind,
       null::text as token, null::timestamptz as expires_at
  from public.company_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
 where public.is_company_member(m.company_id) or public.is_platform_admin()
union all
select i.company_id, null, i.email, null, i.role::text, i.created_at, 'convite', i.token, i.expires_at
  from public.company_member_invites i
 where i.accepted_at is null and i.revoked_at is null
   and (public.is_company_admin(i.company_id));

-- Lista de empresas do admin.
drop view if exists public.admin_companies;
create view public.admin_companies as
select c.id, c.name, c.legal_name, c.cnpj, c.status, c.customer_group, c.created_at,
       h.plan_code,
       (select pl.name from public.plans pl where pl.code = h.plan_code) as plan_name,
       (select count(*) from public.company_members m where m.company_id = c.id) as members_count,
       (select count(*) from public.company_member_invites i where i.company_id = c.id and i.accepted_at is null and i.revoked_at is null) as pending_invites,
       (select count(*) from public.referrer_links l where l.company_id = c.id and l.active and l.archived_at is null) as indicators_count,
       (select count(*) from public.offers o where o.company_id = c.id and o.active and o.archived_at is null) as offers_count
  from public.companies c
  left join public.company_plan_history h on h.company_id = c.id and h.ends_at is null
 where c.archived_at is null and public.is_platform_admin();

-- Corrige company_my_companies: o plano vem direto do histórico (a função de plano não é pública).
create or replace view public.company_my_companies as
select c.id, c.name, c.legal_name, c.cnpj, c.status, c.phone, c.email, c.finance_email, c.website,
       c.address_zip, c.address_street, c.address_number, c.address_complement, c.address_district,
       c.address_city, c.address_state, c.customer_group,
       coalesce(m.role::text, case when public.is_platform_admin() then 'plataforma' end) as my_role,
       (m.role = 'admin' or public.is_platform_admin()) as can_edit,
       (select h.plan_code from public.company_plan_history h where h.company_id = c.id and h.ends_at is null) as plan_code
  from public.companies c
  left join public.company_members m on m.company_id = c.id and m.user_id = auth.uid()
 where c.archived_at is null and (m.user_id is not null or public.is_platform_admin());

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on function public.is_valid_cnpj(text),
  public.admin_create_company(text, text, text, text, text),
  public.admin_update_company_legal(uuid, text, text, text, text),
  public.company_grant_access(uuid, text, text), public.company_revoke_access(uuid, uuid),
  public.company_set_member_role(uuid, uuid, text), public.company_cancel_access_invite(text),
  public.access_invite_info(text), public.accept_access_invite(text)
  from public, anon, authenticated;
grant execute on function public.is_valid_cnpj(text),
  public.admin_create_company(text, text, text, text, text),
  public.admin_update_company_legal(uuid, text, text, text, text),
  public.company_grant_access(uuid, text, text), public.company_revoke_access(uuid, uuid),
  public.company_set_member_role(uuid, uuid, text), public.company_cancel_access_invite(text),
  public.accept_access_invite(text)
  to authenticated;
grant execute on function public.access_invite_info(text) to anon, authenticated;
grant select on public.company_team, public.admin_companies to authenticated;
