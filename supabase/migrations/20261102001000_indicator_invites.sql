-- =====================================================================
-- Indiki+  |  Convite da empresa e cadastro completo do indicador (v1)
--
-- Fluxo:
--  1. A empresa tem um LINK DE CONVITE (company_invites). Ela copia e manda para os clientes.
--  2. O cliente abre o link, confirma o e-mail (link mágico) e preenche o cadastro completo:
--     nome, telefone, data de nascimento, cidade, CPF, chave PIX e aceite dos termos.
--  3. indicator_register grava o perfil e VINCULA a pessoa à empresa do convite
--     (referrer_links), gerando o código de indicação dela naquela empresa.
--  4. A mesma conta pode entrar em várias empresas: nos convites seguintes o cadastro
--     já está pronto e só o vínculo é criado.
--
-- Segurança: o link pode vazar, então a empresa pode PAUSAR ou RENOVAR (o antigo morre).
-- Quem entra por convite fica ativo; a empresa pode pausar o indicador a qualquer momento.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfil completo
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists registration_completed_at timestamptz;
alter table public.profiles drop constraint if exists profiles_state_ok;
alter table public.profiles add constraint profiles_state_ok check (state is null or state ~ '^[A-Z]{2}$');

alter table public.referrer_links add column if not exists invite_id uuid;

-- ---------------------------------------------------------------------
-- Convites da empresa
-- ---------------------------------------------------------------------
create table if not exists public.company_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  token       text not null unique check (token ~ '^[A-Z0-9]{8,16}$'),
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index if not exists idx_company_invites_company on public.company_invites (company_id, created_at desc);
alter table public.company_invites enable row level security;
revoke all on public.company_invites from anon, authenticated;
drop trigger if exists trg_no_delete on public.company_invites;
create trigger trg_no_delete before delete on public.company_invites for each row execute function public.forbid_delete();

alter table public.referrer_links drop constraint if exists referrer_links_invite_fk;
alter table public.referrer_links add constraint referrer_links_invite_fk
  foreign key (invite_id) references public.company_invites (id) on delete restrict;

create or replace function public.gen_invite_token() returns text
language plpgsql volatile set search_path = '' as $$
declare v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; v_t text; i int; n int := 0;
begin
  loop
    v_t := '';
    for i in 1..10 loop
      v_t := v_t || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.company_invites where token = v_t);
    n := n + 1;
    if n > 50 then raise exception 'Não foi possível gerar um link único.'; end if;
  end loop;
  return v_t;
end $$;
revoke all on function public.gen_invite_token() from public, anon, authenticated;

-- EMPRESA: devolve o convite atual (cria o primeiro se não houver). "joined" = cadastros feitos por convite, somando os links antigos.
create or replace function public.company_invite_get(p_company uuid)
returns table (token text, active boolean, joined bigint, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v public.company_invites;
begin
  if not (public.is_platform_admin() or public.is_company_member(p_company)) then
    raise exception 'Sem permissão nesta empresa.' using errcode = 'insufficient_privilege';
  end if;
  select * into v from public.company_invites i where i.company_id = p_company and i.revoked_at is null
   order by i.created_at desc limit 1;
  if not found then
    insert into public.company_invites (company_id, token, created_by)
    values (p_company, public.gen_invite_token(), auth.uid()) returning * into v;
  end if;
  return query select v.token, v.active,
    (select count(*) from public.referrer_links l join public.company_invites i2 on i2.id = l.invite_id where i2.company_id = p_company),
    v.created_at;
end $$;

-- EMPRESA: pausa ou reativa o convite atual.
create or replace function public.company_invite_set_active(p_company uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_platform_admin() or public.is_company_member(p_company)) then
    raise exception 'Sem permissão nesta empresa.' using errcode = 'insufficient_privilege';
  end if;
  update public.company_invites set active = p_active where company_id = p_company and revoked_at is null;
end $$;

-- EMPRESA: renova o link. O antigo para de funcionar na hora; quem já se cadastrou continua vinculado.
create or replace function public.company_invite_rotate(p_company uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not (public.is_platform_admin() or public.is_company_member(p_company)) then
    raise exception 'Sem permissão nesta empresa.' using errcode = 'insufficient_privilege';
  end if;
  update public.company_invites set active = false, revoked_at = now() where company_id = p_company and revoked_at is null;
  v_token := public.gen_invite_token();
  insert into public.company_invites (company_id, token, created_by) values (p_company, v_token, auth.uid());
  return v_token;
end $$;

-- PÚBLICO: o que a pessoa vê ao abrir o link (só o nome da empresa e se o link vale).
create or replace function public.invite_info(p_token text)
returns table (company_name text, valid boolean)
language sql stable security definer set search_path = '' as $$
  select c.name, (i.active and i.revoked_at is null and c.status = 'ativa' and c.archived_at is null)
    from public.company_invites i
    join public.companies c on c.id = i.company_id
   where i.token = upper(btrim(coalesce(p_token, '')))
$$;

-- ---------------------------------------------------------------------
-- Chave PIX: confere o formato e normaliza.
-- ---------------------------------------------------------------------
create or replace function public.normalize_pix(p_type text, p_key text) returns text
language plpgsql immutable set search_path = '' as $$
declare k text := btrim(coalesce(p_key, '')); d text := regexp_replace(k, '\D', '', 'g');
begin
  case p_type
    when 'cpf'      then if not public.is_valid_cpf(d) then raise exception 'Chave PIX: CPF inválido.'; end if; return d;
    when 'cnpj'     then if length(d) <> 14 then raise exception 'Chave PIX: CNPJ deve ter 14 números.'; end if; return d;
    when 'email'    then if lower(k) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Chave PIX: e-mail inválido.'; end if; return lower(k);
    when 'telefone' then if length(d) not between 10 and 13 then raise exception 'Chave PIX: telefone inválido (DDD + número).'; end if; return right(d, 11);
    when 'aleatoria' then
      if lower(k) !~ '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$' then
        raise exception 'Chave PIX: a chave aleatória tem 32 letras e números.';
      end if;
      return lower(k);
    else raise exception 'Escolha o tipo da chave PIX.';
  end case;
end $$;
revoke all on function public.normalize_pix(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- INDICADOR: cadastro completo + vínculo com a empresa do convite.
--   p_token nulo = só atualiza o cadastro (tela "Meu cadastro").
--   Devolve o código de indicação na empresa (ou nulo se não houve convite).
-- ---------------------------------------------------------------------
create or replace function public.indicator_register(
  p_token text,
  p_full_name text,
  p_phone text,
  p_birth_date date,
  p_city text,
  p_state text,
  p_cpf text,
  p_pix_type text,
  p_pix_key text,
  p_profile_kind text,
  p_terms_version text,
  p_accept_terms boolean
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_confirmed timestamptz;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_digits text := public.norm_phone(p_phone);
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_state text := upper(btrim(coalesce(p_state, '')));
  v_pix text;
  v_inv public.company_invites; v_company uuid;
  v_link public.referrer_links; v_code text;
begin
  if v_uid is null then raise exception 'Entre para continuar.' using errcode = 'insufficient_privilege'; end if;
  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_confirmed is null then raise exception 'Confirme o seu e-mail antes de continuar.'; end if;

  if length(v_name) < 5 or position(' ' in v_name) = 0 then raise exception 'Informe o nome completo, como está no documento.'; end if;
  if v_digits is null then raise exception 'Informe o telefone com DDD.'; end if;
  if p_birth_date is null or p_birth_date > current_date - interval '18 years' or p_birth_date < date '1900-01-01' then
    raise exception 'Para receber comissões é preciso ter 18 anos ou mais.';
  end if;
  if length(btrim(coalesce(p_city, ''))) < 2 then raise exception 'Informe a cidade.'; end if;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'Informe o estado (UF).'; end if;
  -- CPF em branco = manter o que já está cadastrado (cadastro pronto, entrando em outra empresa)
  if v_cpf = '' then select t.cpf into v_cpf from public.indicator_tax_profiles t where t.user_id = v_uid; v_cpf := coalesce(v_cpf, ''); end if;
  if not public.is_valid_cpf(v_cpf) then raise exception 'CPF inválido.'; end if;
  if p_profile_kind not in ('cliente', 'profissional') then raise exception 'Escolha se você é cliente ou profissional.'; end if;
  if not coalesce(p_accept_terms, false) or nullif(btrim(coalesce(p_terms_version, '')), '') is null then
    raise exception 'É preciso aceitar os termos para continuar.';
  end if;
  v_pix := public.normalize_pix(p_pix_type, p_pix_key);
  if exists (select 1 from public.indicator_tax_profiles t where t.cpf = v_cpf and t.user_id <> v_uid) then
    raise exception 'Este CPF já está cadastrado em outra conta.';
  end if;

  -- convite (se veio por link)
  if p_token is not null and btrim(p_token) <> '' then
    select * into v_inv from public.company_invites where token = upper(btrim(p_token));
    if not found or not v_inv.active or v_inv.revoked_at is not null then
      raise exception 'Este link de convite não está mais ativo. Peça um novo à empresa.';
    end if;
    if not exists (select 1 from public.companies where id = v_inv.company_id and status = 'ativa' and archived_at is null) then
      raise exception 'Empresa indisponível.';
    end if;
    v_company := v_inv.company_id;
  end if;

  -- perfil
  insert into public.profiles (id, full_name, phone, profile_kind, pix_key, pix_key_type, birth_date, city, state,
                               terms_version, terms_accepted_at, registration_completed_at)
  values (v_uid, v_name, btrim(p_phone), p_profile_kind, v_pix, p_pix_type, p_birth_date, btrim(p_city), v_state,
          btrim(p_terms_version), now(), now())
  on conflict (id) do update
     set full_name = excluded.full_name, phone = excluded.phone, profile_kind = excluded.profile_kind,
         pix_key = excluded.pix_key, pix_key_type = excluded.pix_key_type, birth_date = excluded.birth_date,
         city = excluded.city, state = excluded.state, updated_at = now(),
         terms_version = excluded.terms_version,
         terms_accepted_at = case when public.profiles.terms_version is distinct from excluded.terms_version
                                  then now() else coalesce(public.profiles.terms_accepted_at, now()) end,
         registration_completed_at = coalesce(public.profiles.registration_completed_at, now());
  perform public.indicator_save_tax_profile(v_cpf, v_name, null);

  if v_company is null then return null; end if;

  -- vínculo: já ligado? cadastro prévio da empresa (mesmo e-mail/telefone)? senão cria.
  select * into v_link from public.referrer_links
   where company_id = v_company and user_id = v_uid and archived_at is null limit 1;
  if found then
    if not v_link.active then raise exception 'A empresa pausou o seu cadastro. Fale com ela para reativar.'; end if;
    return v_link.code;
  end if;

  select * into v_link from public.referrer_links
   where company_id = v_company and user_id is null and archived_at is null
     and ((email is not null and email = lower(v_email)) or (phone_digits is not null and phone_digits = v_digits))
   order by (email = lower(v_email)) desc nulls last limit 1 for update;
  if found then
    update public.referrer_links
       set user_id = v_uid, linked_at = now(), invite_id = v_inv.id,
           full_name = v_name, email = coalesce(email, lower(v_email)), phone = btrim(p_phone), phone_digits = v_digits
     where id = v_link.id;
    return v_link.code;
  end if;

  if exists (select 1 from public.referrer_links where company_id = v_company and archived_at is null
              and (email = lower(v_email) or phone_digits = v_digits)) then
    raise exception 'Este telefone ou e-mail já está cadastrado nesta empresa em outra conta. Fale com a empresa.';
  end if;

  v_code := public.gen_referral_code(v_name);
  insert into public.referrer_links (company_id, user_id, code, full_name, email, phone, phone_digits, linked_at, invite_id)
  values (v_company, v_uid, v_code, v_name, lower(v_email), btrim(p_phone), v_digits, now(), v_inv.id);
  return v_code;
end $$;

-- INDICADOR: o próprio cadastro, para pré-preencher a tela (CPF mascarado só para conferência).
create or replace view public.indicator_my_profile as
select p.id as user_id, p.full_name, p.phone, p.profile_kind, p.birth_date, p.city, p.state,
       p.pix_key_type, p.pix_key, p.terms_version, p.registration_completed_at,
       case when t.cpf is not null then '***.' || substr(t.cpf, 4, 3) || '.***-' || right(t.cpf, 2) end as cpf_masked,
       (p.registration_completed_at is not null) as completed
  from public.profiles p
  left join public.indicator_tax_profiles t on t.user_id = p.id
 where p.id = auth.uid();

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on function public.company_invite_get(uuid), public.company_invite_set_active(uuid, boolean),
  public.company_invite_rotate(uuid), public.invite_info(text),
  public.indicator_register(text, text, text, date, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.company_invite_get(uuid), public.company_invite_set_active(uuid, boolean),
  public.company_invite_rotate(uuid),
  public.indicator_register(text, text, text, date, text, text, text, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;
grant select on public.indicator_my_profile to authenticated;
