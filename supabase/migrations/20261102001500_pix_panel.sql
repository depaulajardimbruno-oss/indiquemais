-- =====================================================================
-- Indiki+  |  PIX na hora de receber, painel do indicador e tela de indicações (v1)
--
--  - O cadastro do indicador continua exigindo CPF (evita cadastro duplicado), mas a chave PIX
--    passa a ser opcional: ela é pedida quando houver comissão para receber.
--  - indicator_set_pix: o indicador cadastra ou troca a chave PIX.
--  - Nenhuma comissão é marcada como paga sem chave PIX cadastrada.
--  - referral_link_info devolve o WhatsApp da empresa (para o amigo falar com ela depois do pedido).
--  - Visões: indicator_my_referrals (indicações + comissão de cada uma) e company_referrals com a regra
--    de comissão congelada (para a empresa ver quanto vai gerar antes de fechar).
-- =====================================================================

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
  -- PIX é opcional no cadastro: só valida se veio preenchido (é exigido na hora de receber).
  if nullif(btrim(coalesce(p_pix_key, '')), '') is not null then v_pix := public.normalize_pix(p_pix_type, p_pix_key); end if;
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
  values (v_uid, v_name, btrim(p_phone), p_profile_kind, v_pix, case when v_pix is not null then p_pix_type end, p_birth_date, btrim(p_city), v_state,
          btrim(p_terms_version), now(), now())
  on conflict (id) do update
     set full_name = excluded.full_name, phone = excluded.phone, profile_kind = excluded.profile_kind,
         pix_key = coalesce(excluded.pix_key, public.profiles.pix_key), pix_key_type = coalesce(excluded.pix_key_type, public.profiles.pix_key_type), birth_date = excluded.birth_date,
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


create or replace function public.indicator_set_pix(p_pix_type text, p_pix_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pix text;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.' using errcode = 'insufficient_privilege'; end if;
  v_pix := public.normalize_pix(p_pix_type, p_pix_key);
  update public.profiles set pix_key = v_pix, pix_key_type = p_pix_type, updated_at = now() where id = auth.uid();
  if not found then raise exception 'Complete o seu cadastro primeiro.'; end if;
end $$;
revoke all on function public.indicator_set_pix(text, text) from public, anon;
grant execute on function public.indicator_set_pix(text, text) to authenticated;

-- Sem chave PIX, a comissão não pode ser dada como paga.
create or replace function public.commission_requires_pix() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paga' and old.status is distinct from 'paga' then
    if not exists (select 1 from public.referrer_links l join public.profiles p on p.id = l.user_id
                    where l.id = new.link_id and p.pix_key is not null) then
      raise exception 'Indicador sem chave PIX: cadastre a chave antes de pagar (comissão %).', new.id using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.commission_requires_pix() from public, anon, authenticated;
drop trigger if exists trg_commission_requires_pix on public.commissions;
create trigger trg_commission_requires_pix before update of status on public.commissions
  for each row execute function public.commission_requires_pix();

-- Link público: passa a trazer o WhatsApp da empresa.
drop function if exists public.referral_link_info(text);
create function public.referral_link_info(p_code text)
returns table (company_name text, referrer_first_name text, offers jsonb, company_phone text)
language sql stable security definer set search_path = '' as $$
  select c.name,
         split_part(btrim(l.full_name), ' ', 1),
         coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'description', o.description) order by o.name)
                     from public.offers o where o.company_id = c.id and o.active and o.archived_at is null), '[]'::jsonb),
         c.phone
    from public.referrer_links l
    join public.companies c on c.id = l.company_id
   where l.code = upper(btrim(coalesce(p_code, ''))) and l.active and l.archived_at is null
     and c.status = 'ativa' and c.archived_at is null
$$;
revoke all on function public.referral_link_info(text) from public;
grant execute on function public.referral_link_info(text) to anon, authenticated;

-- Indicador: cada indicação com a comissão (valor da comissão sim; valor da venda não).
drop view if exists public.indicator_my_referrals;
create view public.indicator_my_referrals as
select r.id, r.company_id, c.name as company_name, o.name as offer_name,
       public.short_name(r.friend_name) as friend, r.stage, r.source, r.created_at, r.stage_changed_at,
       (r.source = 'declarado' and r.declared_confirmed_at is null) as awaiting_my_confirmation,
       m.amount_cents as commission_cents, m.status as commission_status, m.release_date, m.paid_at
  from public.referrals r
  join public.referrer_links l on l.id = r.link_id
  join public.companies c on c.id = r.company_id
  join public.offers o on o.id = r.offer_id
  left join public.commissions m on m.referral_id = r.id
 where l.user_id = auth.uid() and r.archived_at is null;
grant select on public.indicator_my_referrals to authenticated;

-- Empresa: indicações com a regra congelada de cada uma.
drop view if exists public.company_referrals;
create view public.company_referrals as
select r.id, r.company_id, o.name as offer_name, r.offer_id, r.friend_name, r.friend_phone, r.stage,
       r.source, r.sale_value_cents, r.contract_number, r.created_at, r.stage_changed_at,
       l.full_name as referrer_name, l.code as referrer_code, l.phone as referrer_phone,
       r.declared_referrer_name, r.declared_referrer_phone,
       (r.source = 'declarado' and r.declared_confirmed_at is null) as awaiting_referrer_confirmation,
       (r.source = 'declarado' and r.link_id is null) as referrer_not_found,
       r.rule_fixed_cents, r.rule_percent_bps, r.rule_cap_cents, r.rule_grace_days,
       m.amount_cents as commission_cents, m.status as commission_status, m.release_date
  from public.referrals r
  join public.offers o on o.id = r.offer_id
  left join public.referrer_links l on l.id = r.link_id
  left join public.commissions m on m.referral_id = r.id
 where (public.is_company_member(r.company_id) or public.is_platform_admin()) and r.archived_at is null;
grant select on public.company_referrals to authenticated;
