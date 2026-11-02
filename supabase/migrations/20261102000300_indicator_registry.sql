-- =====================================================================
-- Indiki+  |  Cadastro manual de indicadores pela empresa (v1)
--
-- Fluxo:
--  1. A empresa cadastra o cliente que fechou: nome, e-mail, telefone.
--     O sistema gera o CÓDIGO e o link dele naquela empresa na hora.
--  2. O cliente entra com o mesmo e-mail (link mágico). Ao confirmar o e-mail,
--     a conta dele se liga sozinha ao cadastro feito pela empresa.
--  3. O amigo pede orçamento: pelo link/código, ou informando nome e telefone
--     de quem indicou. Pelo telefone (ou nome único) o sistema acha o indicador.
--  4. Indicação declarada só vale depois que o indicador confirma no painel.
--
-- Esta migração ajusta a tabela referrer_links: o cadastro passa a existir ANTES
-- de a pessoa ter conta (user_id é preenchido no primeiro login).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Telefone normalizado (só dígitos, últimos 11) e código de indicador
-- ---------------------------------------------------------------------
create or replace function public.norm_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10
              then right(regexp_replace(p, '\D', '', 'g'), 11) end
$$;

-- Código curto e legível, sem letras confundíveis (0/O, 1/I): MARINA-7K4Q
create or replace function public.gen_referral_code(p_name text) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_base text := left(upper(regexp_replace(translate(split_part(btrim(p_name), ' ', 1),
                   'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                   'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '[^A-Za-z]', '', 'g')), 8);
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text; v_suffix text; i int; n int := 0;
begin
  if v_base is null or length(v_base) < 2 then v_base := 'AMIGO'; end if;
  loop
    v_suffix := '';
    for i in 1..4 loop
      v_suffix := v_suffix || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    v_code := v_base || '-' || v_suffix;
    exit when not exists (select 1 from public.referrer_links where code = v_code);
    n := n + 1;
    if n > 50 then raise exception 'Não foi possível gerar um código único.'; end if;
  end loop;
  return v_code;
end $$;

-- ---------------------------------------------------------------------
-- referrer_links vira o "cadastro de indicador da empresa"
-- ---------------------------------------------------------------------
alter table public.referrer_links alter column user_id drop not null;
alter table public.referrer_links add column if not exists full_name    text;
alter table public.referrer_links add column if not exists email        text;
alter table public.referrer_links add column if not exists phone        text;
alter table public.referrer_links add column if not exists phone_digits text;
alter table public.referrer_links add column if not exists registered_by uuid references public.profiles (id) on delete restrict;
alter table public.referrer_links add column if not exists linked_at    timestamptz;   -- quando a pessoa entrou e se ligou ao cadastro

update public.referrer_links l
   set full_name = coalesce(l.full_name, p.full_name),
       phone = coalesce(l.phone, p.phone),
       phone_digits = coalesce(l.phone_digits, public.norm_phone(p.phone))
  from public.profiles p
 where p.id = l.user_id and l.full_name is null;

alter table public.referrer_links alter column full_name set not null;
alter table public.referrer_links drop constraint if exists referrer_links_name_ok;
alter table public.referrer_links add constraint referrer_links_name_ok check (length(btrim(full_name)) > 0);
alter table public.referrer_links drop constraint if exists referrer_links_email_ok;
alter table public.referrer_links add constraint referrer_links_email_ok check (email is null or email = lower(btrim(email)));
alter table public.referrer_links drop constraint if exists referrer_links_contact_ok;
-- precisa de e-mail (para entrar) ou telefone (para ser achado pelo amigo)
alter table public.referrer_links add constraint referrer_links_contact_ok check (email is not null or phone_digits is not null);
-- Formato do código: letras, números e hífen, 4 a 24
alter table public.referrer_links drop constraint if exists referrer_links_code_check;
alter table public.referrer_links add constraint referrer_links_code_check check (code ~ '^[A-Z0-9-]{4,24}$');

-- Um e-mail e um telefone por empresa (evita cadastro duplicado e achar a pessoa errada).
drop index if exists public.uq_links_company_email;
drop index if exists public.uq_links_company_phone;
create unique index uq_links_company_email on public.referrer_links (company_id, email) where email is not null and archived_at is null;
create unique index uq_links_company_phone on public.referrer_links (company_id, phone_digits) where phone_digits is not null and archived_at is null;
create index if not exists idx_links_email on public.referrer_links (email);

-- ---------------------------------------------------------------------
-- EMPRESA: cadastra um indicador (cliente que já fechou). Gera o código.
-- ---------------------------------------------------------------------
create or replace function public.company_register_indicator(
  p_company uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_customer_since date default null
) returns text                                 -- devolve o código gerado
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_digits text := public.norm_phone(p_phone);
  v_user uuid; v_code text;
begin
  if not (public.is_platform_admin() or public.is_company_member(p_company)) then
    raise exception 'Sem permissão nesta empresa.' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_full_name, ''))) = 0 then raise exception 'Informe o nome do cliente.'; end if;
  if v_email is null and v_digits is null then
    raise exception 'Informe o e-mail (para o cliente entrar) ou o telefone com DDD (para ser achado pelo amigo).';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if p_phone is not null and btrim(p_phone) <> '' and v_digits is null then raise exception 'Telefone inválido: use DDD + número.'; end if;
  if exists (select 1 from public.referrer_links where company_id = p_company and archived_at is null
              and ((v_email is not null and email = v_email) or (v_digits is not null and phone_digits = v_digits))) then
    raise exception 'Este cliente já está cadastrado nesta empresa (mesmo e-mail ou telefone).';
  end if;

  -- Se a pessoa já tem conta confirmada com esse e-mail, liga na hora.
  if v_email is not null then
    select id into v_user from auth.users where lower(email) = v_email and email_confirmed_at is not null limit 1;
  end if;
  v_code := public.gen_referral_code(p_full_name);
  insert into public.referrer_links (company_id, user_id, code, full_name, email, phone, phone_digits,
                                     customer_since, registered_by, linked_at)
  values (p_company, v_user, v_code, btrim(p_full_name), v_email, nullif(btrim(coalesce(p_phone, '')), ''), v_digits,
          p_customer_since, auth.uid(), case when v_user is not null then now() end);
  return v_code;
end $$;

-- EMPRESA: pausa ou reativa um indicador (nunca apaga).
create or replace function public.company_set_indicator_active(p_link uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  select company_id into v_company from public.referrer_links where id = p_link;
  if v_company is null then raise exception 'Indicador não encontrado.'; end if;
  if not (public.is_platform_admin() or public.is_company_member(v_company)) then
    raise exception 'Sem permissão nesta empresa.' using errcode = 'insufficient_privilege';
  end if;
  update public.referrer_links set active = p_active where id = p_link;
end $$;

-- ---------------------------------------------------------------------
-- Primeiro login: liga a conta ao cadastro feito pela empresa
-- ---------------------------------------------------------------------
create or replace function public.link_registered_indicator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and new.email is not null then
    -- garante o perfil (caso este gatilho rode antes do de criação)
    insert into public.profiles (id, full_name)
    select new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
    where exists (select 1 from public.referrer_links where email = lower(btrim(new.email)) and user_id is null and archived_at is null)
    on conflict (id) do nothing;

    update public.referrer_links
       set user_id = new.id, linked_at = now()
     where email = lower(btrim(new.email)) and user_id is null and archived_at is null;

    -- usa o nome e o telefone que a empresa cadastrou, se o perfil ainda estiver vazio
    update public.profiles p
       set phone = coalesce(p.phone, (select l.phone from public.referrer_links l where l.user_id = new.id and l.phone is not null limit 1)),
           full_name = case when p.full_name = split_part(new.email, '@', 1)
                            then coalesce((select l.full_name from public.referrer_links l where l.user_id = new.id limit 1), p.full_name)
                            else p.full_name end
     where p.id = new.id;
  end if;
  return null;
end $$;
revoke all on function public.link_registered_indicator() from public, anon, authenticated;

drop trigger if exists zz_link_registered_indicator on auth.users;
create trigger zz_link_registered_indicator after insert or update of email_confirmed_at on auth.users
  for each row execute function public.link_registered_indicator();

-- ---------------------------------------------------------------------
-- Pedido de orçamento: acha o indicador pelo código, telefone ou nome
-- ---------------------------------------------------------------------
create or replace function public.submit_quote_request(
  p_friend_name text,
  p_friend_phone text,
  p_offer_id uuid,
  p_consent boolean,
  p_consent_version text,
  p_code text default null,
  p_company_id uuid default null,
  p_declared_referrer_name text default null,
  p_declared_referrer_phone text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.referrer_links;
  v_company uuid;
  v_source public.referral_source;
  v_link_id uuid;
  v_dname text := nullif(btrim(coalesce(p_declared_referrer_name, '')), '');
  v_dphone text := nullif(btrim(coalesce(p_declared_referrer_phone, '')), '');
  v_count int;
  v_id uuid;
begin
  if not coalesce(p_consent, false) then
    raise exception 'É necessário concordar com o uso dos dados para pedir o orçamento.';
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    select * into v_link from public.referrer_links
      where code = upper(btrim(p_code)) and active and archived_at is null;
    if not found then raise exception 'Código ou link de indicação inválido.'; end if;
    v_company := v_link.company_id; v_link_id := v_link.id; v_source := 'link';
  else
    v_company := p_company_id;
    if v_company is null then raise exception 'Informe a empresa.'; end if;
    if v_dname is null and v_dphone is null then
      v_source := 'direto';
    else
      v_source := 'declarado';
      -- 1) pelo telefone (mais confiável)
      if public.norm_phone(v_dphone) is not null then
        select id into v_link_id from public.referrer_links
         where company_id = v_company and phone_digits = public.norm_phone(v_dphone) and active and archived_at is null;
      end if;
      -- 2) pelo nome, só se houver exatamente um com esse nome na empresa
      if v_link_id is null and v_dname is not null then
        select count(*), (array_agg(id))[1] into v_count, v_link_id from public.referrer_links
         where company_id = v_company and lower(btrim(full_name)) = lower(v_dname) and active and archived_at is null;
        if v_count <> 1 then v_link_id := null; end if;
      end if;
      if v_dname is null then v_dname := 'Informado só pelo telefone'; end if;
    end if;
  end if;

  if not exists (select 1 from public.companies where id = v_company and status = 'ativa' and archived_at is null) then
    raise exception 'Empresa indisponível.';
  end if;
  if not exists (select 1 from public.offers where id = p_offer_id and company_id = v_company and active and archived_at is null) then
    raise exception 'Produto indisponível nesta empresa.';
  end if;

  insert into public.referrals (
    company_id, offer_id, link_id, source, declared_referrer_name, declared_referrer_phone,
    friend_name, friend_phone, consent_at, consent_version
  ) values (
    v_company, p_offer_id, v_link_id, v_source,
    case when v_source = 'declarado' then v_dname end,
    case when v_source = 'declarado' then v_dphone end,
    btrim(p_friend_name), btrim(p_friend_phone), now(), p_consent_version
  ) returning id into v_id;
  return v_id;
end $$;

-- EMPRESA: quando o sistema não achou o indicador, escolhe na lista de indicadores da empresa.
-- Continua dependendo da confirmação do próprio indicador.
create or replace function public.company_link_declared_referrer(p_referral uuid, p_link uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.referrals;
begin
  select * into r from public.referrals where id = p_referral for update;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  if not (public.is_platform_admin() or public.is_company_member(r.company_id)) then
    raise exception 'Sem permissão.' using errcode = 'insufficient_privilege';
  end if;
  if r.source <> 'declarado' or r.declared_confirmed_at is not null then
    raise exception 'Só dá para vincular indicações declaradas e ainda não confirmadas.';
  end if;
  if not exists (select 1 from public.referrer_links where id = p_link and company_id = r.company_id and active and archived_at is null) then
    raise exception 'Indicador não encontrado nesta empresa.';
  end if;
  update public.referrals set link_id = p_link where id = r.id;
end $$;

-- INDICADOR: confirma ou recusa uma indicação declarada em seu nome.
create or replace function public.indicator_answer_declared(p_referral uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.referrals;
begin
  select rf.* into r from public.referrals rf
    join public.referrer_links l on l.id = rf.link_id
   where rf.id = p_referral and l.user_id = auth.uid()
     and rf.source = 'declarado' and rf.declared_confirmed_at is null
   for update of rf;
  if not found then raise exception 'Indicação não encontrada ou já respondida.' using errcode = 'insufficient_privilege'; end if;
  if p_accept then
    update public.referrals set declared_confirmed_at = now() where id = r.id;
  else
    update public.referrals set source = 'direto', link_id = null,
           declared_referrer_name = null, declared_referrer_phone = null where id = r.id;
  end if;
end $$;

-- Sem confirmação do indicador, a indicação declarada não pode fechar venda (nem gerar comissão).
create or replace function public.referral_requires_confirmed_referrer() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.stage in ('fechou', 'instalada', 'paga') and new.stage is distinct from old.stage
     and new.source = 'declarado' and new.declared_confirmed_at is null then
    raise exception 'Aguardando o indicador confirmar a indicação antes de fechar.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_referral_requires_confirmed on public.referrals;
create trigger trg_referral_requires_confirmed before update on public.referrals
  for each row execute function public.referral_requires_confirmed_referrer();

-- ---------------------------------------------------------------------
-- Visões atualizadas
-- ---------------------------------------------------------------------
drop view if exists public.indicator_pending_declarations;
create view public.indicator_pending_declarations as
select r.id, r.company_id, c.name as company_name, public.short_name(r.friend_name) as friend, r.created_at
  from public.referrals r
  join public.referrer_links l on l.id = r.link_id
  join public.companies c on c.id = r.company_id
 where l.user_id = auth.uid() and r.source = 'declarado' and r.declared_confirmed_at is null and r.archived_at is null;

drop view if exists public.indicator_referrals;
create view public.indicator_referrals as
select r.id, r.company_id, c.name as company_name, o.name as offer_name,
       public.short_name(r.friend_name) as friend, r.stage, r.source, r.created_at,
       (r.source = 'declarado' and r.declared_confirmed_at is null) as awaiting_my_confirmation
  from public.referrals r
  join public.referrer_links l on l.id = r.link_id
  join public.companies c on c.id = r.company_id
  join public.offers o on o.id = r.offer_id
 where l.user_id = auth.uid() and r.archived_at is null;

drop view if exists public.indicator_links;
create view public.indicator_links as
select l.id, l.company_id, c.name as company_name, l.code, l.customer_since
  from public.referrer_links l
  join public.companies c on c.id = l.company_id
 where l.user_id = auth.uid() and l.archived_at is null and l.active;

drop view if exists public.company_referrals;
create view public.company_referrals as
select r.id, r.company_id, o.name as offer_name, r.friend_name, r.friend_phone, r.stage,
       r.source, r.sale_value_cents, r.created_at, r.stage_changed_at,
       l.full_name as referrer_name, l.code as referrer_code, r.declared_referrer_name, r.declared_referrer_phone,
       (r.source = 'declarado' and r.declared_confirmed_at is null) as awaiting_referrer_confirmation,
       (r.source = 'declarado' and r.link_id is null) as referrer_not_found
  from public.referrals r
  join public.offers o on o.id = r.offer_id
  left join public.referrer_links l on l.id = r.link_id
 where (public.is_company_member(r.company_id) or public.is_platform_admin()) and r.archived_at is null;

drop view if exists public.company_commissions;
create view public.company_commissions as
select m.id, m.company_id, m.referral_id, l.full_name as referrer_name, m.amount_cents,
       m.status, m.release_date, m.paid_at, m.created_at
  from public.commissions m
  join public.referrer_links l on l.id = m.link_id
 where public.is_company_member(m.company_id) or public.is_platform_admin();

-- EMPRESA: lista de indicadores cadastrados (sem chave PIX).
create or replace view public.company_indicators as
select l.id, l.company_id, l.full_name, l.email, l.phone, l.code, l.active, l.customer_since,
       (l.user_id is not null) as has_account, l.created_at,
       (select count(*) from public.referrals r where r.link_id = l.id) as referrals_count
  from public.referrer_links l
 where (public.is_company_member(l.company_id) or public.is_platform_admin()) and l.archived_at is null;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on function public.norm_phone(text), public.gen_referral_code(text) from public, anon, authenticated;
revoke all on function public.company_register_indicator(uuid, text, text, text, date) from public, anon;
revoke all on function public.company_set_indicator_active(uuid, boolean) from public, anon;
revoke all on function public.company_link_declared_referrer(uuid, uuid) from public, anon;
grant execute on function public.company_register_indicator(uuid, text, text, text, date) to authenticated;
grant execute on function public.company_set_indicator_active(uuid, boolean) to authenticated;
grant execute on function public.company_link_declared_referrer(uuid, uuid) to authenticated;

grant select on public.indicator_pending_declarations, public.indicator_referrals, public.indicator_links,
                public.company_referrals, public.company_commissions, public.company_indicators to authenticated;
