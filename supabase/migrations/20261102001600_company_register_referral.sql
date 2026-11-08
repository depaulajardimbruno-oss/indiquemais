-- =====================================================================
-- Indiki+  |  Empresa registra indicação que chegou por fora do link (v1)
--
-- O amigo procurou a empresa direto (WhatsApp, loja, telefone) e disse quem indicou.
-- A empresa registra: cliente, produto e o indicador (escolhido na lista dela).
-- A indicação nasce como "declarada": o indicador confirma no painel dele ("Sim, fui eu").
-- Sem essa confirmação, a venda não pode ser marcada como fechada (regra que já existia).
-- Se o mesmo telefone de cliente já tem indicação em andamento na empresa, o registro é recusado
-- (evita indicação em dobro); a tela avisa antes.
-- =====================================================================

create or replace function public.company_register_referral(
  p_company uuid,
  p_offer uuid,
  p_friend_name text,
  p_friend_phone text,
  p_link uuid,
  p_client_consent boolean,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.referrer_links; v_id uuid; v_digits text := public.norm_phone(p_friend_phone);
begin
  if not (public.is_platform_admin() or public.is_company_member(p_company)) then
    raise exception 'Sem permissão nesta empresa.' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(p_client_consent, false) then
    raise exception 'Confirme que o cliente autorizou o uso dos dados dele para registrar a indicação.';
  end if;
  if length(btrim(coalesce(p_friend_name, ''))) < 3 then raise exception 'Informe o nome do cliente.'; end if;
  if v_digits is null then raise exception 'Informe o telefone do cliente com DDD.'; end if;
  if not exists (select 1 from public.offers where id = p_offer and company_id = p_company and active and archived_at is null) then
    raise exception 'Escolha um produto ativo da empresa.';
  end if;
  select * into l from public.referrer_links where id = p_link and company_id = p_company and archived_at is null;
  if not found then raise exception 'Escolha o indicador na lista da empresa.'; end if;
  if not l.active or l.request_status <> 'aprovado' then raise exception 'Este indicador está pausado ou ainda não foi aceito.'; end if;
  if exists (select 1 from public.referrals r where r.company_id = p_company and r.archived_at is null
              and public.norm_phone(r.friend_phone) = v_digits and r.stage in ('indicado', 'orcamento', 'fechou')) then
    raise exception 'Este cliente já tem uma indicação em andamento. Confira na lista antes de registrar outra.';
  end if;

  insert into public.referrals (company_id, offer_id, link_id, source, declared_referrer_name, declared_referrer_phone,
                                friend_name, friend_phone, consent_at, consent_version)
  values (p_company, p_offer, l.id, 'declarado', l.full_name, l.phone,
          btrim(p_friend_name), btrim(p_friend_phone), now(), 'empresa-registro-v1')
  returning id into v_id;

  insert into public.audit_log (table_name, row_id, action, new_data, actor)
  values ('referrals', v_id::text, 'REGISTRO_EMPRESA', jsonb_build_object('link', l.id, 'note', nullif(btrim(coalesce(p_note, '')), '')), auth.uid());
  return v_id;
end $$;

revoke all on function public.company_register_referral(uuid, uuid, text, text, uuid, boolean, text) from public, anon;
grant execute on function public.company_register_referral(uuid, uuid, text, text, uuid, boolean, text) to authenticated;
