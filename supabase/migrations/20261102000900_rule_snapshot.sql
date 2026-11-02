-- =====================================================================
-- Indiki+  |  Regra de comissão congelada na indicação + histórico de versões (v1)
--
-- Combinado: a empresa pode editar a comissão do produto a qualquer momento, mas a
-- mudança vale só para indicações CRIADAS depois. Quem indicou sabendo "ganho R$ 300"
-- recebe R$ 300, mesmo que o produto passe a pagar R$ 200.
--
--  - offer_rule_versions: histórico (só cresce). Cada mudança de regra do produto gera uma versão.
--  - referrals.rule_*: "foto" da regra no instante em que a indicação nasce. Não muda mais.
--  - A comissão é calculada pela foto da indicação, nunca pela regra atual do produto.
--  - Exceção: só o admin do Indiki+, com motivo (mín. 5 letras) e auditoria, e só antes de a
--    comissão ser liberada (admin_correct_referral_rule).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Versões da regra do produto
-- ---------------------------------------------------------------------
alter table public.offers add column if not exists rule_version int not null default 1;

create table if not exists public.offer_rule_versions (
  offer_id        uuid not null references public.offers (id) on delete restrict,
  version         int  not null,
  fixed_cents     int,
  percent_bps     int,
  cap_cents       int,
  grace_days      int  not null,
  valid_from      timestamptz not null default now(),
  changed_by      uuid,
  primary key (offer_id, version)
);
alter table public.offer_rule_versions enable row level security;
revoke all on public.offer_rule_versions from anon, authenticated;
drop trigger if exists trg_no_delete on public.offer_rule_versions;
create trigger trg_no_delete before delete on public.offer_rule_versions for each row execute function public.forbid_delete();
drop trigger if exists trg_append_only on public.offer_rule_versions;
create trigger trg_append_only before update or delete on public.offer_rule_versions for each row execute function public.forbid_change();

-- Versão 1 para os produtos que já existem.
insert into public.offer_rule_versions (offer_id, version, fixed_cents, percent_bps, cap_cents, grace_days)
select id, rule_version, commission_fixed_cents, commission_percent_bps, commission_cap_cents, grace_days
  from public.offers on conflict do nothing;

-- Qualquer caminho que mude a regra do produto gera uma versão nova (inclusive o SQL Editor).
create or replace function public.offer_rule_bump() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.commission_fixed_cents is not distinct from old.commission_fixed_cents
       and new.commission_percent_bps is not distinct from old.commission_percent_bps
       and new.commission_cap_cents is not distinct from old.commission_cap_cents
       and new.grace_days is not distinct from old.grace_days then
      new.rule_version := old.rule_version;
      return new;
    end if;
    new.rule_version := old.rule_version + 1;
  else
    new.rule_version := 1;
  end if;
  return new;
end $$;
revoke all on function public.offer_rule_bump() from public, anon, authenticated;
drop trigger if exists trg_offer_rule_bump on public.offers;
create trigger trg_offer_rule_bump before insert or update on public.offers
  for each row execute function public.offer_rule_bump();

create or replace function public.offer_rule_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.rule_version <> old.rule_version then
    insert into public.offer_rule_versions (offer_id, version, fixed_cents, percent_bps, cap_cents, grace_days, changed_by)
    values (new.id, new.rule_version, new.commission_fixed_cents, new.commission_percent_bps, new.commission_cap_cents, new.grace_days, auth.uid());
  end if;
  return null;
end $$;
revoke all on function public.offer_rule_log() from public, anon, authenticated;
drop trigger if exists trg_offer_rule_log on public.offers;
create trigger trg_offer_rule_log after insert or update on public.offers
  for each row execute function public.offer_rule_log();

-- ---------------------------------------------------------------------
-- Foto da regra dentro da indicação
-- ---------------------------------------------------------------------
alter table public.referrals add column if not exists rule_version int;
alter table public.referrals add column if not exists rule_fixed_cents int;
alter table public.referrals add column if not exists rule_percent_bps int;
alter table public.referrals add column if not exists rule_cap_cents int;
alter table public.referrals add column if not exists rule_grace_days int;

-- Indicações que já existem recebem a regra atual do produto (é a que valia até agora).
update public.referrals r
   set rule_version = o.rule_version, rule_fixed_cents = o.commission_fixed_cents,
       rule_percent_bps = o.commission_percent_bps, rule_cap_cents = o.commission_cap_cents,
       rule_grace_days = o.grace_days
  from public.offers o
 where o.id = r.offer_id and r.rule_version is null;

alter table public.referrals alter column rule_version set not null;
alter table public.referrals alter column rule_grace_days set not null;

create or replace function public.referral_snapshot_rule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.offers;
begin
  select * into o from public.offers where id = new.offer_id;
  new.rule_version := o.rule_version;
  new.rule_fixed_cents := o.commission_fixed_cents;
  new.rule_percent_bps := o.commission_percent_bps;
  new.rule_cap_cents := o.commission_cap_cents;
  new.rule_grace_days := o.grace_days;
  return new;
end $$;
revoke all on function public.referral_snapshot_rule() from public, anon, authenticated;
drop trigger if exists trg_referral_snapshot_rule on public.referrals;
create trigger trg_referral_snapshot_rule before insert on public.referrals
  for each row execute function public.referral_snapshot_rule();

-- A foto não muda. Só a função do admin (com motivo) abre a exceção.
create or replace function public.referral_rule_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.rule_version, new.rule_fixed_cents, new.rule_percent_bps, new.rule_cap_cents, new.rule_grace_days)
     is distinct from (old.rule_version, old.rule_fixed_cents, old.rule_percent_bps, old.rule_cap_cents, old.rule_grace_days)
     and coalesce(current_setting('indikimais.rule_override', true), '') <> 'on' then
    raise exception 'A regra de comissão desta indicação foi definida quando ela foi criada e não pode mudar.' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_referral_rule_immutable on public.referrals;
create trigger trg_referral_rule_immutable before update on public.referrals
  for each row execute function public.referral_rule_immutable();

-- Cálculo pela foto da indicação (valor do contrato em centavos).
create or replace function public.calc_commission_ref(p_referral uuid, p_contract_value_cents int) returns int
language plpgsql stable set search_path = '' as $$
declare r public.referrals; v numeric;
begin
  select * into r from public.referrals where id = p_referral;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  v := coalesce(r.rule_fixed_cents, 0)
       + round(coalesce(p_contract_value_cents, 0)::numeric * coalesce(r.rule_percent_bps, 0) / 10000);
  if r.rule_cap_cents is not null then v := least(v, r.rule_cap_cents); end if;
  return v::int;
end $$;
revoke all on function public.calc_commission_ref(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Fechar venda e corrigir valor passam a usar a foto (e o prazo de liberação da foto)
-- ---------------------------------------------------------------------
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
    values (r.id, r.company_id, r.link_id, public.calc_commission_ref(r.id, v_value), 'pendente')
    on conflict (referral_id) do nothing;
  else
    update public.referrals set stage = p_stage where id = r.id;
  end if;

  if p_stage = 'instalada' then
    update public.commissions set release_date = current_date + r.rule_grace_days where referral_id = r.id and status = 'pendente';
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

  v_new := public.calc_commission_ref(r.id, p_sale_value_cents);
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
-- Telas da empresa: histórico da regra e quantas indicações seguem na regra antiga
-- ---------------------------------------------------------------------
drop view if exists public.company_offer_rule_history;
create view public.company_offer_rule_history as
select v.offer_id, o.company_id, v.version, v.fixed_cents, v.percent_bps, v.cap_cents, v.grace_days,
       v.valid_from, p.full_name as changed_by_name,
       (select count(*) from public.referrals r
         where r.offer_id = v.offer_id and r.rule_version = v.version and r.archived_at is null) as referrals_count,
       (select count(*) from public.referrals r
         where r.offer_id = v.offer_id and r.rule_version = v.version and r.archived_at is null
           and r.stage in ('indicado', 'orcamento', 'fechou', 'instalada')) as open_referrals_count
  from public.offer_rule_versions v
  join public.offers o on o.id = v.offer_id
  left join public.profiles p on p.id = v.changed_by
 where public.is_company_member(o.company_id) or public.is_platform_admin();
grant select on public.company_offer_rule_history to authenticated;

-- ---------------------------------------------------------------------
-- ADMIN: correção excepcional da regra de UMA indicação (erro de digitação etc.)
-- Só antes de a comissão ser liberada. Exige motivo e deixa auditoria.
-- ---------------------------------------------------------------------
create or replace function public.admin_correct_referral_rule(
  p_referral uuid, p_fixed_cents int, p_percent_bps int, p_cap_cents int, p_grace_days int, p_reason text
) returns int
language plpgsql security definer set search_path = '' as $$
declare r public.referrals; c public.commissions; v_new int; v_has boolean;
begin
  if not public.is_platform_admin() then raise exception 'Somente a plataforma.' using errcode = 'insufficient_privilege'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Explique o motivo da correção.'; end if;
  if coalesce(p_fixed_cents, 0) <= 0 and coalesce(p_percent_bps, 0) <= 0 then raise exception 'Defina um valor fixo, uma porcentagem, ou os dois.'; end if;
  if p_percent_bps is not null and p_percent_bps not between 0 and 5000 then raise exception 'Porcentagem inválida.'; end if;
  if p_grace_days is null or p_grace_days < 0 then raise exception 'Prazo de liberação inválido.'; end if;
  select * into r from public.referrals where id = p_referral for update;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  select * into c from public.commissions where referral_id = r.id for update;
  v_has := found;
  if v_has and c.status <> 'pendente' then
    raise exception 'A comissão já foi liberada ou paga: a regra não pode mais ser corrigida.';
  end if;

  perform set_config('indikimais.rule_override', 'on', true);
  update public.referrals
     set rule_fixed_cents = nullif(p_fixed_cents, 0), rule_percent_bps = nullif(p_percent_bps, 0),
         rule_cap_cents = nullif(p_cap_cents, 0), rule_grace_days = p_grace_days
   where id = r.id;
  perform set_config('indikimais.rule_override', 'off', true);

  v_new := null;
  if v_has then
    v_new := public.calc_commission_ref(r.id, r.sale_value_cents);
    update public.commissions set amount_cents = v_new where id = c.id;
  end if;
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
  values ('referrals', r.id::text, 'CORRECAO_REGRA',
          jsonb_build_object('fixed', r.rule_fixed_cents, 'percent_bps', r.rule_percent_bps, 'cap', r.rule_cap_cents, 'grace_days', r.rule_grace_days, 'commission_cents', c.amount_cents),
          jsonb_build_object('fixed', nullif(p_fixed_cents, 0), 'percent_bps', nullif(p_percent_bps, 0), 'cap', nullif(p_cap_cents, 0), 'grace_days', p_grace_days, 'commission_cents', v_new, 'reason', p_reason),
          auth.uid());
  return v_new;
end $$;
revoke all on function public.admin_correct_referral_rule(uuid, int, int, int, int, text) from public, anon;
grant execute on function public.admin_correct_referral_rule(uuid, int, int, int, int, text) to authenticated;
