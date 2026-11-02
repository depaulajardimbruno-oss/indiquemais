-- =====================================================================
-- Indiki+ — A empresa repassa as comissões ao Indiki+, e o Indiki+ paga os indicadores
-- (como no PDF). A taxa do Indiki+ é cobrada da empresa POR CIMA da comissão:
--   empresa paga = comissão cheia (repasse) + taxa do plano sobre a venda
--   indicador recebe = comissão cheia (menos retenções de imposto, se houver)
-- O Indiki+ só paga o indicador depois que o repasse daquela comissão foi pago pela empresa
-- (regra ligada por padrão, desligável em platform_settings: require_repasse_before_payout).
-- O repasse é dinheiro de passagem, não receita do Indiki+ (confirmar o tratamento com o contador).
-- =====================================================================

insert into public.platform_settings (key, value, description) values
  ('require_repasse_before_payout', 'true', 'Se "true", só paga o indicador depois que a empresa pagou o repasse da comissão.')
on conflict (key) do nothing;

-- Nova espécie de fatura: repasse de comissões.
alter table public.invoices drop constraint if exists invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check check (kind in ('mensalidade', 'taxa_vendas', 'repasse_comissoes'));
-- Pode haver mais de um repasse no mesmo mês (comissões liberadas em momentos diferentes).
drop index if exists public.uq_invoice_company_kind_month;
create unique index uq_invoice_company_kind_month on public.invoices (company_id, kind, period_month)
  where status <> 'cancelada' and kind <> 'repasse_comissoes';

alter table public.invoice_items add column if not exists commission_id uuid references public.commissions (id) on delete restrict;
create unique index if not exists uq_invoice_item_commission on public.invoice_items (commission_id) where commission_id is not null and active;

-- A comissão já foi repassada pela empresa?
create or replace view public.commission_funding as
select c.id as commission_id, c.company_id,
       exists (select 1 from public.invoice_items i join public.invoices v on v.id = i.invoice_id
                where i.commission_id = c.id and i.active and v.status = 'paga') as funded,
       exists (select 1 from public.invoice_items i join public.invoices v on v.id = i.invoice_id
                where i.commission_id = c.id and i.active and v.status = 'aberta') as billed_open
  from public.commissions c;
revoke all on public.commission_funding from anon, authenticated;

-- Geração de faturas: agora inclui o repasse das comissões liberadas ainda não cobradas.
create or replace function public.generate_invoices(p_month date, p_allow_open_month boolean default false, p_actor uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare v_month date := date_trunc('month', p_month)::date; v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
        v_due int; c record; v_plan text; v_price int; v_total int; v_inv uuid; n int := 0;
begin
  select coalesce(nullif(value, '')::int, 10) into v_due from public.platform_settings where key = 'invoice_due_days';
  v_due := coalesce(v_due, 10);
  for c in select id, name from public.companies where archived_at is null and status = 'ativa' loop
    -- 1) mensalidade do plano
    select h.plan_code, p.monthly_price_cents into v_plan, v_price
      from public.company_plan_history h join public.plans p on p.code = h.plan_code
     where h.company_id = c.id and h.starts_at < v_next and (h.ends_at is null or h.ends_at >= v_month)
     order by h.starts_at desc limit 1;
    if v_price is not null and v_price > 0
       and not exists (select 1 from public.invoices where company_id = c.id and kind = 'mensalidade' and period_month = v_month and status <> 'cancelada') then
      insert into public.invoices (number, company_id, kind, period_month, plan_code, description, amount_cents, due_date, created_by)
      values (public.next_doc_number('invoice', 'F'), c.id, 'mensalidade', v_month, v_plan,
              'Mensalidade do plano ' || (select name from public.plans where code = v_plan) || ' — ' || to_char(v_month, 'MM/YYYY'),
              v_price, current_date + v_due, p_actor);
      n := n + 1;
    end if;
    -- 2) taxa sobre vendas fechadas no mês (só depois de o mês acabar, salvo pedido explícito)
    if (p_allow_open_month or v_next <= current_date)
       and not exists (select 1 from public.invoices where company_id = c.id and kind = 'taxa_vendas' and period_month = v_month and status <> 'cancelada') then
      select coalesce(sum(l.fee_cents), 0) into v_total
        from public.sale_fee_lines l
       where l.company_id = c.id and l.closed_at >= v_month and l.closed_at < v_next
         and not exists (select 1 from public.invoice_items i where i.referral_id = l.referral_id and i.active);
      if v_total > 0 then
        insert into public.invoices (number, company_id, kind, period_month, description, amount_cents, due_date, created_by)
        values (public.next_doc_number('invoice', 'F'), c.id, 'taxa_vendas', v_month,
                'Taxa sobre vendas por indicação — ' || to_char(v_month, 'MM/YYYY'), v_total, current_date + v_due, p_actor)
        returning id into v_inv;
        insert into public.invoice_items (invoice_id, referral_id, description, base_cents, fee_bps, amount_cents)
        select v_inv, l.referral_id, 'Venda — contrato ' || coalesce(l.contract_number, 's/n'), l.sale_value_cents, l.fee_bps, l.fee_cents
          from public.sale_fee_lines l
         where l.company_id = c.id and l.closed_at >= v_month and l.closed_at < v_next
           and not exists (select 1 from public.invoice_items i where i.referral_id = l.referral_id and i.active and i.invoice_id <> v_inv);
        n := n + 1;
      end if;
    end if;
    -- 3) repasse das comissões liberadas e ainda não cobradas (a empresa paga ao Indiki+, que paga o indicador)
    select coalesce(sum(m.amount_cents), 0) into v_total
      from public.commissions m
     where m.company_id = c.id and m.status = 'liberada'
       and not exists (select 1 from public.invoice_items i where i.commission_id = m.id and i.active);
    if v_total > 0 then
      insert into public.invoices (number, company_id, kind, period_month, description, amount_cents, due_date, created_by)
      values (public.next_doc_number('invoice', 'F'), c.id, 'repasse_comissoes', v_month,
              'Repasse de comissões aos indicadores — ' || to_char(v_month, 'MM/YYYY') || ' (valor de passagem, não é receita do Indiki+)',
              v_total, current_date + v_due, p_actor)
      returning id into v_inv;
      insert into public.invoice_items (invoice_id, commission_id, referral_id, description, base_cents, amount_cents)
      select v_inv, m.id, null, 'Comissão — contrato ' || coalesce(r.contract_number, 's/n') || ' — ' || coalesce(l.full_name, 'indicador'),
             r.sale_value_cents, m.amount_cents
        from public.commissions m
        join public.referrals r on r.id = m.referral_id
        join public.referrer_links l on l.id = m.link_id
       where m.company_id = c.id and m.status = 'liberada'
         and not exists (select 1 from public.invoice_items i where i.commission_id = m.id and i.active and i.invoice_id <> v_inv);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Pagamento do mês: só paga o indicador se a empresa já repassou aquela comissão.
create or replace function public.admin_pay_month(p_month date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_batch uuid; v_month date := date_trunc('month', p_month)::date; v_req text;
begin
  if not public.is_platform_admin() then raise exception 'Somente a plataforma.' using errcode = 'insufficient_privilege'; end if;
  select value into v_req from public.platform_settings where key = 'require_repasse_before_payout';
  insert into public.payout_batches (month_ref) values (v_month) on conflict (month_ref) do nothing;
  select id into v_batch from public.payout_batches where month_ref = v_month for update;
  update public.commissions c
     set status = 'paga', batch_id = v_batch, paid_at = now()
   where c.status = 'liberada'
     and (coalesce(v_req, 'true') <> 'true'
          or exists (select 1 from public.invoice_items i join public.invoices v on v.id = i.invoice_id
                      where i.commission_id = c.id and i.active and v.status = 'paga'));
  update public.referrals r set stage = 'paga'
    from public.commissions c
   where c.referral_id = r.id and c.batch_id = v_batch and r.stage = 'instalada';
  update public.payout_batches set status = 'pago', paid_at = now() where id = v_batch;
  return v_batch;
end $$;
revoke all on function public.admin_pay_month(date) from public, anon;
grant execute on function public.admin_pay_month(date) to authenticated;

-- Comissões liberadas que estão esperando o repasse da empresa (painel do administrador).
create or replace view public.admin_pending_repasse as
select m.company_id, co.name as company_name, count(*)::int as commissions, sum(m.amount_cents)::bigint as amount_cents,
       count(*) filter (where f.billed_open)::int as billed_open,
       count(*) filter (where not f.billed_open)::int as not_billed
  from public.commissions m
  join public.companies co on co.id = m.company_id
  join public.commission_funding f on f.commission_id = m.id
 where public.is_platform_admin() and m.status = 'liberada' and not f.funded
 group by m.company_id, co.name;

-- O indicador enxerga se a comissão liberada já foi repassada pela empresa.
create or replace view public.indicator_commission_funding as
select m.id as commission_id, co.name as company_name, m.amount_cents, m.status,
       f.funded, f.billed_open,
       case when f.funded then 'Repasse recebido: pagamento no fim do mês'
            when f.billed_open then 'Aguardando o repasse da empresa ao Indiki+'
            else 'Será cobrada da empresa no próximo fechamento' end as funding_note
  from public.commissions m
  join public.referrer_links l on l.id = m.link_id
  join public.companies co on co.id = m.company_id
  join public.commission_funding f on f.commission_id = m.id
 where l.user_id = auth.uid() and m.status = 'liberada';

-- Painel do administrador: receita (mensalidade + taxa) separada do repasse (dinheiro de passagem).
create or replace view public.admin_billing_overview as
select i.period_month,
       count(*)::int as invoices,
       coalesce(sum(i.amount_cents) filter (where i.status <> 'cancelada' and i.kind <> 'repasse_comissoes'), 0)::bigint as issued_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'paga' and i.kind <> 'repasse_comissoes'), 0)::bigint as received_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'aberta' and i.due_date >= current_date and i.kind <> 'repasse_comissoes'), 0)::bigint as open_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'aberta' and i.due_date < current_date and i.kind <> 'repasse_comissoes'), 0)::bigint as overdue_cents,
       coalesce(sum(i.amount_cents) filter (where i.status <> 'cancelada' and i.kind = 'repasse_comissoes'), 0)::bigint as repasse_issued_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'paga' and i.kind = 'repasse_comissoes'), 0)::bigint as repasse_received_cents,
       coalesce(sum(i.amount_cents) filter (where i.status = 'aberta' and i.kind = 'repasse_comissoes'), 0)::bigint as repasse_open_cents
  from public.invoices i
 where public.is_platform_admin()
 group by i.period_month;

-- Quanto a empresa pagou: taxas do Indiki+ separadas do repasse.
create or replace view public.company_annual_payments as
select r.company_id, extract(year from r.issued_at)::int as year, count(*)::int as receipts, sum(r.amount_cents)::bigint as paid_cents,
       coalesce(sum(r.amount_cents) filter (where v.kind <> 'repasse_comissoes'), 0)::bigint as fees_paid_cents,
       coalesce(sum(r.amount_cents) filter (where v.kind = 'repasse_comissoes'), 0)::bigint as repasse_paid_cents
  from public.receipts r join public.invoices v on v.id = r.invoice_id
 where public.is_company_member(r.company_id) or public.is_platform_admin()
 group by r.company_id, extract(year from r.issued_at);

-- Critério do selo "pagamentos em dia" agora tem medição: faturas pagas até o vencimento.
create or replace function public.company_seal_metrics(p_company uuid) returns table (criterion text, raw_value int)
language sql stable security definer set search_path = '' as $$
  select 'closed_sales', count(*)::int from public.referrals
   where company_id = p_company and stage in ('fechou', 'instalada', 'paga') and contract_number is not null
  union all
  select 'confirmed_commissions', count(*)::int from public.commissions
   where company_id = p_company and confirmed_at is not null
  union all
  select 'disputes', count(*)::int from public.commissions
   where company_id = p_company and contested_at is not null
  union all
  select 'months_active',
         greatest(0, (extract(year from age(now(), c.created_at)) * 12 + extract(month from age(now(), c.created_at)))::int)
    from public.companies c where c.id = p_company
  union all
  select 'fee_on_time', count(*)::int from public.invoices
   where company_id = p_company and status = 'paga' and paid_at::date <= due_date
$$;
update public.seal_criteria set name = 'Faturas pagas em dia', description = 'Faturas (taxas e repasses) pagas até o vencimento.' where code = 'fee_on_time';

grant select on public.admin_pending_repasse, public.indicator_commission_funding to authenticated;
revoke all on function public.generate_invoices(date, boolean, uuid), public.company_seal_metrics(uuid) from public, anon, authenticated;
