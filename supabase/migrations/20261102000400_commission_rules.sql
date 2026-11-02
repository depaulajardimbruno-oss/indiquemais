-- =====================================================================
-- Indiki+  |  Regra de comissão flexível + número do contrato (v1)
--
-- Os serviços são sob medida: o valor só existe no fechamento. Então a regra
-- de comissão é configurada por produto e calculada sobre o CONTRATO TOTAL:
--     comissão = fixo + (percentual × valor do contrato), limitada ao teto (se houver)
-- Qualquer parte pode faltar:
--     só fixo            -> R$ 300 por venda
--     só percentual      -> 3% do contrato
--     fixo + percentual  -> R$ 100 + 2% do contrato
--     com teto opcional  -> nunca passa de R$ X
--
-- Ao marcar "fechou" a empresa informa o valor do contrato e o NÚMERO do
-- contrato/pedido (o mesmo do CRM dela). O número não se repete na empresa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- offers: regra em três colunas (substitui commission_type/commission_value)
-- ---------------------------------------------------------------------
alter table public.offers add column if not exists commission_fixed_cents int;
alter table public.offers add column if not exists commission_percent_bps int;   -- 200 = 2%
alter table public.offers add column if not exists commission_cap_cents  int;    -- teto opcional

-- Aproveita o que já existir (a tabela está vazia no começo, mas a migração é segura se não estiver).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'offers' and column_name = 'commission_type') then
    update public.offers
       set commission_fixed_cents = case when commission_type::text = 'fixed' then commission_value end,
           commission_percent_bps = case when commission_type::text = 'percent' then commission_value end
     where commission_fixed_cents is null and commission_percent_bps is null;
    alter table public.offers drop column commission_type;
    alter table public.offers drop column commission_value;
  end if;
end $$;

alter table public.offers drop constraint if exists offers_commission_rule_ok;
alter table public.offers add constraint offers_commission_rule_ok check (
  (coalesce(commission_fixed_cents, 0) > 0 or coalesce(commission_percent_bps, 0) > 0)
  and (commission_fixed_cents is null or commission_fixed_cents > 0)
  and (commission_percent_bps is null or commission_percent_bps between 1 and 5000)   -- até 50%
  and (commission_cap_cents is null or commission_cap_cents > 0)
  and (commission_cap_cents is null or commission_fixed_cents is null or commission_cap_cents >= commission_fixed_cents)
);

-- Cálculo único da comissão (usado ao fechar e ao corrigir o valor).
create or replace function public.calc_commission(p_offer uuid, p_contract_value_cents int) returns int
language plpgsql stable set search_path = '' as $$
declare o public.offers; v numeric;
begin
  select * into o from public.offers where id = p_offer;
  if not found then raise exception 'Produto não encontrado.'; end if;
  v := coalesce(o.commission_fixed_cents, 0)
       + round(coalesce(p_contract_value_cents, 0)::numeric * coalesce(o.commission_percent_bps, 0) / 10000);
  if o.commission_cap_cents is not null then v := least(v, o.commission_cap_cents); end if;
  return v::int;
end $$;
revoke all on function public.calc_commission(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- referrals: número do contrato
-- ---------------------------------------------------------------------
alter table public.referrals add column if not exists contract_number text;
alter table public.referrals drop constraint if exists referrals_contract_ok;
alter table public.referrals add constraint referrals_contract_ok check (
  contract_number is null or length(btrim(contract_number)) between 1 and 60
);
-- Fechada exige valor e número do contrato.
alter table public.referrals drop constraint if exists referrals_closed_needs_contract;
alter table public.referrals add constraint referrals_closed_needs_contract check (
  stage in ('indicado', 'orcamento', 'perdido')
  or (contract_number is not null and sale_value_cents is not null and sale_value_cents > 0)
) not valid;   -- "not valid": registros antigos não são reavaliados; vale para tudo daqui em diante
drop index if exists public.uq_referrals_contract;
create unique index uq_referrals_contract on public.referrals (company_id, upper(btrim(contract_number)))
  where contract_number is not null;          -- o mesmo contrato não gera duas comissões

-- ---------------------------------------------------------------------
-- A comissão pode ser recalculada SOMENTE enquanto estiver "pendente"
-- ---------------------------------------------------------------------
create or replace function public.commission_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.referral_id <> old.referral_id or new.link_id <> old.link_id or new.company_id <> old.company_id then
    raise exception 'Vínculos da comissão não podem ser alterados.' using errcode = 'restrict_violation';
  end if;
  if new.amount_cents <> old.amount_cents and not (old.status = 'pendente' and new.status = 'pendente') then
    raise exception 'O valor da comissão só pode mudar enquanto ela estiver pendente.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- EMPRESA: cadastro do produto com a regra de comissão
-- ---------------------------------------------------------------------
drop function if exists public.company_save_offer(uuid, uuid, text, text, public.commission_type, int, int, boolean);
create or replace function public.company_save_offer(
  p_company uuid,
  p_offer uuid,                              -- null = novo produto
  p_name text,
  p_description text,
  p_fixed_cents int,                         -- valor fixo em centavos (ou null)
  p_percent_bps int,                         -- porcentagem do contrato em pontos-base: 200 = 2% (ou null)
  p_cap_cents int default null,              -- teto opcional em centavos
  p_grace_days int default 30,
  p_active boolean default true
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_fixed int := nullif(p_fixed_cents, 0); v_pct int := nullif(p_percent_bps, 0); v_cap int := nullif(p_cap_cents, 0);
begin
  if not (public.is_platform_admin() or exists (
        select 1 from public.company_members
         where company_id = p_company and user_id = auth.uid() and role = 'admin')) then
    raise exception 'Só administradores da empresa cadastram produtos.' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Informe o nome do produto.'; end if;
  if v_fixed is null and v_pct is null then raise exception 'Defina a comissão: um valor fixo, uma porcentagem do contrato, ou os dois.'; end if;
  if v_fixed is not null and v_fixed < 0 then raise exception 'Valor fixo inválido.'; end if;
  if v_pct is not null and (v_pct < 0 or v_pct > 10000) then raise exception 'A porcentagem não pode passar de 100%%.'; end if;
  if v_pct is not null and v_pct > 5000 then raise exception 'Porcentagem acima de 50%% precisa ser validada com o Indiki+.'; end if;
  if v_cap is not null and v_cap < 0 then raise exception 'Teto inválido.'; end if;
  if v_cap is not null and v_fixed is not null and v_cap < v_fixed then raise exception 'O teto não pode ser menor que o valor fixo.'; end if;

  if p_offer is null then
    insert into public.offers (company_id, name, description, commission_fixed_cents, commission_percent_bps, commission_cap_cents, grace_days, active)
    values (p_company, btrim(p_name), p_description, v_fixed, v_pct, v_cap, coalesce(p_grace_days, 30), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.offers
       set name = btrim(p_name), description = p_description,
           commission_fixed_cents = v_fixed, commission_percent_bps = v_pct, commission_cap_cents = v_cap,
           grace_days = coalesce(p_grace_days, grace_days), active = coalesce(p_active, active)
     where id = p_offer and company_id = p_company and archived_at is null
    returning id into v_id;
    if v_id is null then raise exception 'Produto não encontrado nesta empresa.'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.company_save_offer(uuid, uuid, text, text, int, int, int, int, boolean) from public, anon;
grant execute on function public.company_save_offer(uuid, uuid, text, text, int, int, int, int, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- EMPRESA: muda a etapa (agora com número do contrato ao fechar)
-- ---------------------------------------------------------------------
drop function if exists public.company_set_referral_stage(uuid, public.referral_stage, int, text);
create or replace function public.company_set_referral_stage(
  p_referral uuid,
  p_stage public.referral_stage,
  p_sale_value_cents int default null,       -- valor TOTAL do contrato (obrigatório ao fechar)
  p_contract_number text default null,       -- número do contrato/pedido no CRM da empresa (obrigatório ao fechar)
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.referrals;
  o public.offers;
  v_admin boolean := public.is_platform_admin();
  v_from int; v_to int;
  v_value int; v_contract text;
begin
  select * into r from public.referrals where id = p_referral for update;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  if not (v_admin or public.is_company_member(r.company_id)) then
    raise exception 'Sem permissão para esta indicação.' using errcode = 'insufficient_privilege';
  end if;
  if r.archived_at is not null then raise exception 'Indicação arquivada.'; end if;
  if p_stage = r.stage then return; end if;

  if p_stage = 'paga' and not v_admin then
    raise exception 'A etapa "paga" é registrada pelo Indiki+ no pagamento mensal.';
  end if;

  if not v_admin then
    if r.stage in ('paga', 'perdido') then raise exception 'Esta indicação já foi encerrada.'; end if;
    if p_stage = 'perdido' then
      if r.stage = 'instalada' then raise exception 'Obra instalada e paga não pode ser marcada como perdida.'; end if;
    else
      v_from := array_position(array['indicado','orcamento','fechou','instalada','paga']::text[], r.stage::text);
      v_to   := array_position(array['indicado','orcamento','fechou','instalada','paga']::text[], p_stage::text);
      if v_to <> v_from + 1 then
        raise exception 'A etapa só avança uma de cada vez (de % para %).', r.stage, p_stage;
      end if;
    end if;
  end if;

  if p_stage in ('fechou', 'instalada', 'paga') and r.link_id is null then
    raise exception 'Esta indicação ainda não tem indicador confirmado.';
  end if;

  select * into o from public.offers where id = r.offer_id;

  if p_stage = 'fechou' then
    v_value := coalesce(p_sale_value_cents, r.sale_value_cents);
    v_contract := nullif(btrim(coalesce(p_contract_number, r.contract_number, '')), '');
    if v_value is null or v_value <= 0 then raise exception 'Informe o valor total do contrato ao marcar como fechada.'; end if;
    if v_contract is null then raise exception 'Informe o número do contrato ou pedido (o mesmo do seu CRM).'; end if;
    if exists (select 1 from public.referrals where company_id = r.company_id and id <> r.id
                and upper(btrim(contract_number)) = upper(v_contract)) then
      raise exception 'O contrato % já está ligado a outra indicação.', v_contract;
    end if;
    update public.referrals set stage = p_stage, sale_value_cents = v_value, contract_number = v_contract where id = r.id;
    insert into public.commissions (referral_id, company_id, link_id, amount_cents, status)
    values (r.id, r.company_id, r.link_id, public.calc_commission(r.offer_id, v_value), 'pendente')
    on conflict (referral_id) do nothing;
  else
    update public.referrals set stage = p_stage where id = r.id;
  end if;

  if p_stage = 'instalada' then
    update public.commissions set release_date = current_date + o.grace_days where referral_id = r.id and status = 'pendente';
  elsif p_stage = 'perdido' then
    update public.commissions set status = 'cancelada' where referral_id = r.id and status in ('pendente', 'liberada');
  end if;

  if p_note is not null then
    insert into public.audit_log (table_name, row_id, action, new_data, actor)
    values ('referrals', r.id::text, 'NOTE', jsonb_build_object('stage', p_stage, 'note', p_note), auth.uid());
  end if;
end $$;
revoke all on function public.company_set_referral_stage(uuid, public.referral_stage, int, text, text) from public, anon;
grant execute on function public.company_set_referral_stage(uuid, public.referral_stage, int, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- EMPRESA: corrige o valor/contrato (desconto, mudança de escopo)
-- Só enquanto a comissão está "pendente". Depois de liberada, trava.
-- A auditoria guarda o valor antigo, o novo, o motivo e quem corrigiu.
-- ---------------------------------------------------------------------
create or replace function public.company_correct_sale(
  p_referral uuid,
  p_sale_value_cents int,
  p_contract_number text default null,
  p_reason text default null
) returns int                                 -- devolve a nova comissão
language plpgsql security definer set search_path = '' as $$
declare r public.referrals; c public.commissions; v_new int; v_contract text;
begin
  select * into r from public.referrals where id = p_referral for update;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  if not (public.is_platform_admin() or public.is_company_member(r.company_id)) then
    raise exception 'Sem permissão.' using errcode = 'insufficient_privilege';
  end if;
  select * into c from public.commissions where referral_id = r.id for update;
  if not found then raise exception 'Esta indicação ainda não tem venda fechada.'; end if;
  if c.status <> 'pendente' then
    raise exception 'A comissão já foi liberada ou paga: o valor não pode mais ser corrigido. Fale com o Indiki+.';
  end if;
  if p_sale_value_cents is null or p_sale_value_cents <= 0 then raise exception 'Informe o novo valor do contrato.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Explique o motivo da correção.'; end if;
  v_contract := coalesce(nullif(btrim(coalesce(p_contract_number, '')), ''), r.contract_number);
  if exists (select 1 from public.referrals where company_id = r.company_id and id <> r.id
              and upper(btrim(contract_number)) = upper(v_contract)) then
    raise exception 'O contrato % já está ligado a outra indicação.', v_contract;
  end if;

  v_new := public.calc_commission(r.offer_id, p_sale_value_cents);
  update public.referrals set sale_value_cents = p_sale_value_cents, contract_number = v_contract where id = r.id;
  update public.commissions set amount_cents = v_new where id = c.id;
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
  values ('referrals', r.id::text, 'CORRECAO_VENDA',
          jsonb_build_object('sale_value_cents', r.sale_value_cents, 'contract_number', r.contract_number, 'commission_cents', c.amount_cents),
          jsonb_build_object('sale_value_cents', p_sale_value_cents, 'contract_number', v_contract, 'commission_cents', v_new, 'reason', p_reason),
          auth.uid());
  return v_new;
end $$;
revoke all on function public.company_correct_sale(uuid, int, text, text) from public, anon;
grant execute on function public.company_correct_sale(uuid, int, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Visões: mostram o contrato (para a empresa) e escondem valores do indicador
-- ---------------------------------------------------------------------
drop view if exists public.company_referrals;
create view public.company_referrals as
select r.id, r.company_id, o.name as offer_name, r.friend_name, r.friend_phone, r.stage,
       r.source, r.sale_value_cents, r.contract_number, r.created_at, r.stage_changed_at,
       l.full_name as referrer_name, l.code as referrer_code, r.declared_referrer_name, r.declared_referrer_phone,
       (r.source = 'declarado' and r.declared_confirmed_at is null) as awaiting_referrer_confirmation,
       (r.source = 'declarado' and r.link_id is null) as referrer_not_found,
       m.amount_cents as commission_cents, m.status as commission_status
  from public.referrals r
  join public.offers o on o.id = r.offer_id
  left join public.referrer_links l on l.id = r.link_id
  left join public.commissions m on m.referral_id = r.id
 where (public.is_company_member(r.company_id) or public.is_platform_admin()) and r.archived_at is null;
grant select on public.company_referrals to authenticated;

drop view if exists public.company_commissions;
create view public.company_commissions as
select m.id, m.company_id, m.referral_id, r.contract_number, l.full_name as referrer_name, m.amount_cents,
       m.status, m.release_date, m.paid_at, m.created_at
  from public.commissions m
  join public.referrals r on r.id = m.referral_id
  join public.referrer_links l on l.id = m.link_id
 where public.is_company_member(m.company_id) or public.is_platform_admin();
grant select on public.company_commissions to authenticated;
