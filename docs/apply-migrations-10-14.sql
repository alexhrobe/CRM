-- === 20240101000010_security_foundation.sql ===

-- ─── Fundação de segurança ───────────────────────────────────────────────────
-- Corrige achados críticos da auditoria (ver SECURITY.md):
--   1. Escalonamento de privilégio no cadastro: handle_new_user() confiava no
--      role vindo do cliente (raw_user_meta_data->>'role'), permitindo que um
--      novo usuário se registrasse direto como 'owner'.
--   2. Funções SECURITY DEFINER sem search_path fixo (risco de hijacking):
--      auto_stall_quotes() e auto_expire_stalled().
--   3. Importação de proposta sem transação (dados órfãos em falha parcial):
--      nova função import_proposal() executa todos os inserts atomicamente.
-- Migration aditiva: substitui apenas as funções afetadas.

-- ── 1. handle_new_user(): o papel NUNCA vem do cliente ───────────────────────
-- Todo usuário criado via signup/convite entra como 'assistant'. A promoção a
-- 'owner' só pode ser feita por um owner já existente (UPDATE protegido pelo
-- trigger prevent_role_escalation, migration 7). O nome continua sendo lido do
-- metadata por conveniência, pois não é sensível.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email, ''),
    'assistant'::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. Fixar search_path nas funções de automação (SECURITY DEFINER) ─────────
create or replace function public.auto_stall_quotes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes
  set stage = 'stalled', updated_at = now()
  where stage = 'sent'
    and last_activity_at < now() - interval '14 days';
end;
$$;

create or replace function public.auto_expire_stalled()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes
  set stage = 'expired', updated_at = now()
  where stage = 'stalled'
    and last_activity_at < now() - interval '30 days'
    and decided_at is null;
end;
$$;

-- ── 3. import_proposal(): importação atômica de proposta ─────────────────────
-- Reaproveita a conta por nome (case-insensitive) ou cria; cria contato
-- (best-effort), cotação e itens — tudo na mesma transação. Se qualquer passo
-- falhar, nada é gravado (sem contas/cotações órfãs). SECURITY INVOKER: roda
-- com as permissões (e RLS) do usuário que chamou.
create or replace function public.import_proposal(p_proposal jsonb, p_owner_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_id uuid;
  v_reused     boolean := false;
  v_quote_id   uuid;
  v_fx         numeric(10,4);
  v_currency   text := p_proposal->'quote'->>'currency';
  v_contact    jsonb := p_proposal->'contact';
  v_item       jsonb;
begin
  -- Conta: reaproveita por nome ou cria
  select id into v_account_id
  from public.accounts
  where legal_name ilike (p_proposal->'account'->>'legal_name')
  limit 1;

  if v_account_id is not null then
    v_reused := true;
  else
    insert into public.accounts (legal_name, country, country_iso2, account_type, currency_default, segment)
    values (
      p_proposal->'account'->>'legal_name',
      p_proposal->'account'->>'country',
      nullif(p_proposal->'account'->>'country_iso2', ''),
      'direct_customer'::public.account_type,
      coalesce(v_currency, 'USD'),
      nullif(p_proposal->'account'->>'segment', '')
    )
    returning id into v_account_id;
  end if;

  -- Contato (best-effort)
  if v_contact is not null
     and coalesce(v_contact->>'name', '') <> ''
     and not exists (
       select 1 from public.contacts
       where account_id = v_account_id and name ilike (v_contact->>'name')
     )
  then
    insert into public.contacts (account_id, name, email, phone, role)
    values (
      v_account_id,
      v_contact->>'name',
      nullif(v_contact->>'email', ''),
      nullif(v_contact->>'phone', ''),
      nullif(v_contact->>'role', '')
    );
  end if;

  -- Câmbio vigente para a moeda
  select rate_to_brl into v_fx
  from public.fx_rates
  where currency = v_currency
  order by date desc
  limit 1;

  -- Cotação
  insert into public.quotes (
    account_id, owner_id, quote_number, quote_type, stage, total_value, currency,
    fx_to_brl, product_group, product_description, received_at, expected_close_at
  )
  values (
    v_account_id,
    p_owner_id,
    p_proposal->'quote'->>'quote_number',
    (p_proposal->'quote'->>'quote_type')::public.quote_type,
    'received'::public.quote_stage,
    nullif(p_proposal->'quote'->>'total_value', '')::numeric,
    coalesce(v_currency, 'USD'),
    v_fx,
    nullif(p_proposal->'quote'->>'product_group', '')::public.product_group,
    nullif(p_proposal->'quote'->>'product_description', ''),
    (p_proposal->'quote'->>'received_at')::timestamptz,
    nullif(p_proposal->'quote'->>'expected_close_at', '')::date
  )
  returning id into v_quote_id;

  -- Itens
  for v_item in
    select * from jsonb_array_elements(coalesce(p_proposal->'items', '[]'::jsonb))
  loop
    insert into public.quote_items (quote_id, product_code, description, quantity, unit_price, total)
    values (
      v_quote_id,
      nullif(v_item->>'product_code', ''),
      nullif(v_item->>'description', ''),
      nullif(v_item->>'quantity', '')::numeric,
      nullif(v_item->>'unit_price', '')::numeric,
      nullif(v_item->>'total', '')::numeric
    );
  end loop;

  return jsonb_build_object(
    'quoteId', v_quote_id,
    'accountId', v_account_id,
    'reusedAccount', v_reused
  );
end;
$$;

-- === 20240101000011_automation_foundation.sql ===

-- ─── Fundação de automação (produção, baixa manutenção) ───────────────────────
-- 1. job_runs — log de jobs agendados (daily maintenance, FX, etc.)
-- 2. v_action_queue — fila de ação única (espelha apps/web/src/lib/automations/rules.ts)
-- 3. v_executive_summary + v_pipeline_by_account — cockpit executivo (views ao vivo)
-- 4. run_daily_maintenance() — auto_stall + auto_expire + log
-- 5. pg_cron — agenda manutenção diária (sem depender de Edge Function)
-- 6. v_pipeline_active — passa a ler alertas de v_action_queue (não brain_alerts)

-- ── 1. job_runs ───────────────────────────────────────────────────────────────
create table if not exists public.job_runs (
  id            uuid primary key default gen_random_uuid(),
  job_name      text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  success       boolean,
  details       jsonb,
  error_message text
);

create index if not exists idx_job_runs_name_started
  on public.job_runs (job_name, started_at desc);

alter table public.job_runs enable row level security;

create policy "job_runs_select"
  on public.job_runs for select
  using (auth.uid() is not null);

-- ── 2. v_action_queue (fonte única de “o que fazer agora”) ────────────────────
-- Limites espelham AUTOMATION_CONFIG em rules.ts:
--   followupSentDays=3, stalledNegotiationDays=10, stalledAnalysisDays=5,
--   validityDays=30, expiringWithinDays=5

create or replace view public.v_action_queue as
with base as (
  select
    q.id                                          as quote_id,
    q.account_id,
    q.quote_number,
    q.stage,
    q.total_value,
    q.currency,
    q.last_activity_at,
    q.received_at,
    q.expected_close_at,
    a.legal_name                                  as account_name,
    a.country_iso2,
    extract(epoch from (now() - q.updated_at)) / 86400.0 as days_in_stage,
    coalesce(
      case when q.total_value is not null and q.fx_to_brl is not null
        then q.total_value * q.fx_to_brl end,
      0
    )                                             as sort_value_brl,
    coalesce(
      q.expected_close_at::timestamptz,
      q.received_at + interval '30 days'
    )                                             as valid_until
  from public.quotes q
  join public.accounts a on a.id = q.account_id
  where q.stage in ('received', 'in_analysis', 'sent', 'negotiation', 'stalled')
),
followup as (
  select
    b.quote_id::text || ':followup'               as id,
    b.quote_id,
    b.account_id,
    b.quote_number,
    b.account_name,
    b.country_iso2,
    b.stage,
    'followup'::text                            as task_kind,
    case
      when floor(extract(epoch from (now() - b.last_activity_at)) / 86400.0) >= 7
        then 'critical'::public.alert_severity
      else 'warning'::public.alert_severity
    end                                           as severity,
    'Follow-up da proposta enviada'::text         as title,
    'Sem resposta há ' || floor(extract(epoch from (now() - b.last_activity_at)) / 86400.0)::int || ' dias' as detail,
    b.total_value,
    b.currency,
    floor(extract(epoch from (now() - b.last_activity_at)) / 86400.0)::int - 3 as overdue_days,
    null::int                                     as due_in_days,
    b.sort_value_brl,
    'Ligar ou enviar follow-up ao cliente'::text  as suggested_action
  from base b
  where b.stage = 'sent'
    and extract(epoch from (now() - b.last_activity_at)) / 86400.0 >= 3
),
stalled_neg as (
  select
    b.quote_id::text || ':stalled'                as id,
    b.quote_id,
    b.account_id,
    b.quote_number,
    b.account_name,
    b.country_iso2,
    b.stage,
    'stalled'::text                               as task_kind,
    case
      when b.days_in_stage >= 15 then 'critical'::public.alert_severity
      else 'warning'::public.alert_severity
    end                                           as severity,
    'Negociação parada — destravar'::text         as title,
    'Há ' || floor(b.days_in_stage)::int || ' dias em negociação' as detail,
    b.total_value,
    b.currency,
    floor(b.days_in_stage)::int - 10              as overdue_days,
    null::int                                     as due_in_days,
    b.sort_value_brl,
    'Revisar condições ou propor alinhamento'::text as suggested_action
  from base b
  where b.stage = 'negotiation'
    and b.days_in_stage > 10
),
stalled_analysis as (
  select
    b.quote_id::text || ':stalled'                as id,
    b.quote_id,
    b.account_id,
    b.quote_number,
    b.account_name,
    b.country_iso2,
    b.stage,
    'stalled'::text                               as task_kind,
    'warning'::public.alert_severity              as severity,
    'Análise parada — avançar'::text              as title,
    'Há ' || floor(b.days_in_stage)::int || ' dias em análise' as detail,
    b.total_value,
    b.currency,
    floor(b.days_in_stage)::int - 5               as overdue_days,
    null::int                                     as due_in_days,
    b.sort_value_brl,
    'Avançar análise interna ou contatar cliente'::text as suggested_action
  from base b
  where b.stage = 'in_analysis'
    and b.days_in_stage > 5
),
expiring as (
  select
    b.quote_id::text || ':expiring'               as id,
    b.quote_id,
    b.account_id,
    b.quote_number,
    b.account_name,
    b.country_iso2,
    b.stage,
    'expiring'::text                              as task_kind,
    case
      when ceil(extract(epoch from (b.valid_until - now())) / 86400.0) < 0
        then 'critical'::public.alert_severity
      when ceil(extract(epoch from (b.valid_until - now())) / 86400.0) <= 1
        then 'critical'::public.alert_severity
      else 'warning'::public.alert_severity
    end                                           as severity,
    case
      when ceil(extract(epoch from (b.valid_until - now())) / 86400.0) < 0
        then 'Validade vencida'::text
      else 'Validade expirando'::text
    end                                           as title,
    case
      when ceil(extract(epoch from (b.valid_until - now())) / 86400.0) < 0
        then 'Venceu há ' || abs(ceil(extract(epoch from (b.valid_until - now())) / 86400.0)::int) || ' dias'
      when ceil(extract(epoch from (b.valid_until - now())) / 86400.0) = 0
        then 'Vence hoje'
      else 'Vence em ' || ceil(extract(epoch from (b.valid_until - now())) / 86400.0)::int || ' dias'
    end                                           as detail,
    b.total_value,
    b.currency,
    case
      when ceil(extract(epoch from (b.valid_until - now())) / 86400.0) < 0
        then abs(ceil(extract(epoch from (b.valid_until - now())) / 86400.0)::int)
      else 0
    end                                           as overdue_days,
    ceil(extract(epoch from (b.valid_until - now())) / 86400.0)::int as due_in_days,
    b.sort_value_brl,
    'Renovar proposta ou confirmar prazo com o cliente'::text as suggested_action
  from base b
  where ceil(extract(epoch from (b.valid_until - now())) / 86400.0) <= 5
)
select
  t.*,
  case t.severity
    when 'critical' then 0
    when 'warning'  then 1
    else 2
  end as severity_ord
from (
  select * from followup
  union all select * from stalled_neg
  union all select * from stalled_analysis
  union all select * from expiring
) t;

-- ── 3. Atualizar v_pipeline_active (alertas = fila de ação) ───────────────────
create or replace view public.v_pipeline_active as
select
  q.*,
  a.legal_name                               as account_name,
  a.country,
  a.country_iso2,
  extract(epoch from (now() - q.updated_at)) / 86400 as days_in_stage,
  case
    when q.total_value is not null and q.fx_to_brl is not null
      then q.total_value * q.fx_to_brl
    else null
  end                                        as total_value_brl,
  exists(
    select 1 from public.v_action_queue aq where aq.quote_id = q.id
  )                                          as has_active_alert,
  (
    select aq.severity from public.v_action_queue aq
    where aq.quote_id = q.id
    order by aq.severity_ord, aq.overdue_days desc, aq.sort_value_brl desc
    limit 1
  )                                          as alert_severity,
  (
    select aq.title from public.v_action_queue aq
    where aq.quote_id = q.id
    order by aq.severity_ord, aq.overdue_days desc, aq.sort_value_brl desc
    limit 1
  )                                          as alert_title
from public.quotes q
join public.accounts a on a.id = q.account_id
where q.stage not in ('won', 'lost', 'expired');

-- ── 4. Views executivas (cockpit — sempre atualizadas) ────────────────────────

create or replace view public.v_pipeline_by_account as
select
  q.account_id,
  a.legal_name                                as account_name,
  a.country_iso2,
  count(q.id)                                 as open_quotes,
  coalesce(sum(q.total_value_brl), 0)         as pipeline_brl,
  coalesce(sum(
    q.total_value_brl * coalesce(q.probability, 50) / 100.0
  ), 0)                                       as pipeline_weighted_brl
from public.v_pipeline_active q
join public.accounts a on a.id = q.account_id
group by q.account_id, a.legal_name, a.country_iso2;

create or replace view public.v_executive_summary as
select
  (select coalesce(sum(total_value_brl), 0) from public.v_pipeline_active) as pipeline_brl,
  (select coalesce(sum(
    total_value_brl * coalesce(probability, 50) / 100.0
  ), 0) from public.v_pipeline_active) as pipeline_weighted_brl,
  (select count(*) from public.v_pipeline_active) as open_quotes,
  (select count(*) from public.v_action_queue) as pending_actions,
  (select count(*) from public.v_action_queue where severity = 'critical') as critical_actions,
  (select coalesce(sum(sort_value_brl), 0) from public.v_action_queue where severity = 'critical') as critical_value_brl,
  (select coalesce(sum(sort_value_brl), 0) from public.v_action_queue) as action_value_brl,
  (
    select coalesce(max(date), '1970-01-01'::date)
    from public.fx_rates where currency = 'USD'
  ) as last_fx_usd_date,
  (
    select coalesce(
      round(
        100.0 * max(pba.pipeline_brl) / nullif(sum(pba.pipeline_brl), 0),
        1
      ),
      0
    )
    from public.v_pipeline_by_account pba
  ) as top_account_concentration_pct,
  (
    select account_name
    from public.v_pipeline_by_account
    order by pipeline_brl desc
    limit 1
  ) as top_account_name;

-- ── 5. run_daily_maintenance() ────────────────────────────────────────────────

create or replace function public.run_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id         uuid;
  v_last_fx        date;
  v_stalled_before int;
  v_stalled_after  int;
  v_expired_before int;
  v_expired_after  int;
  v_details        jsonb;
begin
  insert into public.job_runs (job_name)
  values ('daily_maintenance')
  returning id into v_run_id;

  select count(*) into v_stalled_before from public.quotes where stage = 'stalled';
  select count(*) into v_expired_before from public.quotes where stage = 'expired';

  perform public.auto_stall_quotes();
  perform public.auto_expire_stalled();

  select count(*) into v_stalled_after from public.quotes where stage = 'stalled';
  select count(*) into v_expired_after from public.quotes where stage = 'expired';

  select max(date) into v_last_fx
  from public.fx_rates where currency = 'USD';

  v_details := jsonb_build_object(
    'stalled_quotes', v_stalled_after,
    'newly_stalled', v_stalled_after - v_stalled_before,
    'expired_quotes', v_expired_after,
    'newly_expired', v_expired_after - v_expired_before,
    'pending_actions', (select count(*) from public.v_action_queue),
    'critical_actions', (select count(*) from public.v_action_queue where severity = 'critical'),
    'last_fx_usd_date', v_last_fx,
    'fx_stale', v_last_fx is null or v_last_fx < current_date - 3
  );

  update public.job_runs
  set finished_at = now(), success = true, details = v_details
  where id = v_run_id;

  return jsonb_build_object('ok', true, 'run_id', v_run_id) || v_details;
exception when others then
  update public.job_runs
  set finished_at = now(), success = false, error_message = SQLERRM
  where id = v_run_id;
  raise;
end;
$$;

-- ── 6. security_invoker nas novas views ───────────────────────────────────────

alter view public.v_action_queue set (security_invoker = on);
alter view public.v_pipeline_by_account set (security_invoker = on);
alter view public.v_executive_summary set (security_invoker = on);

-- ── 7. pg_cron — manutenção diária às 07:00 BRT (10:00 UTC) ───────────────────

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'plp-daily-maintenance') then
    perform cron.unschedule('plp-daily-maintenance');
  end if;
  perform cron.schedule(
    'plp-daily-maintenance',
    '0 10 * * *',
    $$select public.run_daily_maintenance()$$
  );
exception
  when undefined_table then
    raise notice 'pg_cron não disponível neste ambiente — agende run_daily_maintenance() manualmente';
  when insufficient_privilege then
    raise notice 'sem privilégio para pg_cron — agende via Supabase Dashboard';
end;
$$;

-- === 20240101000012_fix_calculation_engine.sql ===

-- ─── Correções do motor de cálculo ─────────────────────────────────────────────
-- Bugs corrigidos:
--   1. v_monthly_kpis: JOIN cartesiano (contagens/somas infladas)
--   2. v_country_metrics: quotes × orders duplicava valores por conta
--   3. v_account_health: quotes × activities duplicava pipeline
--   4. total_value_brl: ignorava cotações sem fx_to_brl (subestimava pipeline)
--   5. v_executive_summary: critical_value_brl somava a mesma cotação várias vezes
--   6. v_action_queue: parada usava updated_at (resetava ao editar campos)
--   7. validade: aritmética por date (evita off-by-one de timezone)

-- ── Helper: valor em BRL com fallback para taxa vigente ───────────────────────

create or replace function public.quote_value_brl(
  p_total   numeric,
  p_currency text,
  p_fx      numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when p_total is null then null
    else p_total * coalesce(p_fx, public.get_fx_rate(p_currency))
  end;
$$;

-- ── v_action_queue (regras alinhadas a rules.ts + last_activity_at) ───────────

create or replace view public.v_action_queue as
with base as (
  select
    q.id                                          as quote_id,
    q.account_id,
    q.quote_number,
    q.stage,
    q.total_value,
    q.currency,
    q.fx_to_brl,
    q.last_activity_at,
    q.received_at,
    q.expected_close_at,
    a.legal_name                                  as account_name,
    a.country_iso2,
    floor(extract(epoch from (now() - q.last_activity_at)) / 86400.0)::int
                                                  as idle_days,
    coalesce(
      public.quote_value_brl(q.total_value, q.currency, q.fx_to_brl),
      0
    )                                             as sort_value_brl,
    (
      coalesce(
        q.expected_close_at,
        (q.received_at at time zone 'America/Sao_Paulo')::date + 30
      ) - current_date
    )::int                                        as days_until_validity
  from public.quotes q
  join public.accounts a on a.id = q.account_id
  where q.stage in ('received', 'in_analysis', 'sent', 'negotiation', 'stalled')
),
followup as (
  select
    b.quote_id::text || ':followup'               as id,
    b.quote_id, b.account_id, b.quote_number, b.account_name, b.country_iso2, b.stage,
    'followup'::text                              as task_kind,
    case when b.idle_days >= 7 then 'critical'::public.alert_severity
         else 'warning'::public.alert_severity end as severity,
    'Follow-up da proposta enviada'::text         as title,
    'Sem resposta há ' || b.idle_days || ' dias'  as detail,
    b.total_value, b.currency,
    b.idle_days - 3                               as overdue_days,
    null::int                                     as due_in_days,
    b.sort_value_brl,
    'Ligar ou enviar follow-up ao cliente'::text  as suggested_action
  from base b
  where b.stage = 'sent' and b.idle_days >= 3
),
stalled_neg as (
  select
    b.quote_id::text || ':stalled'                as id,
    b.quote_id, b.account_id, b.quote_number, b.account_name, b.country_iso2, b.stage,
    'stalled'::text                               as task_kind,
    case when b.idle_days >= 15 then 'critical'::public.alert_severity
         else 'warning'::public.alert_severity end as severity,
    'Negociação parada — destravar'::text         as title,
    'Há ' || b.idle_days || ' dias sem atividade em negociação' as detail,
    b.total_value, b.currency,
    b.idle_days - 10                              as overdue_days,
    null::int                                     as due_in_days,
    b.sort_value_brl,
    'Revisar condições ou propor alinhamento'::text as suggested_action
  from base b
  where b.stage = 'negotiation' and b.idle_days > 10
),
stalled_analysis as (
  select
    b.quote_id::text || ':stalled'                as id,
    b.quote_id, b.account_id, b.quote_number, b.account_name, b.country_iso2, b.stage,
    'stalled'::text                               as task_kind,
    'warning'::public.alert_severity              as severity,
    'Análise parada — avançar'::text              as title,
    'Há ' || b.idle_days || ' dias sem atividade em análise' as detail,
    b.total_value, b.currency,
    b.idle_days - 5                               as overdue_days,
    null::int                                     as due_in_days,
    b.sort_value_brl,
    'Avançar análise interna ou contatar cliente'::text as suggested_action
  from base b
  where b.stage = 'in_analysis' and b.idle_days > 5
),
expiring as (
  select
    b.quote_id::text || ':expiring'               as id,
    b.quote_id, b.account_id, b.quote_number, b.account_name, b.country_iso2, b.stage,
    'expiring'::text                              as task_kind,
    case
      when b.days_until_validity < 0 then 'critical'::public.alert_severity
      when b.days_until_validity <= 1 then 'critical'::public.alert_severity
      else 'warning'::public.alert_severity
    end                                           as severity,
    case when b.days_until_validity < 0 then 'Validade vencida'::text
         else 'Validade expirando'::text end      as title,
    case
      when b.days_until_validity < 0
        then 'Venceu há ' || abs(b.days_until_validity) || ' dias'
      when b.days_until_validity = 0 then 'Vence hoje'
      else 'Vence em ' || b.days_until_validity || ' dias'
    end                                           as detail,
    b.total_value, b.currency,
    case when b.days_until_validity < 0 then abs(b.days_until_validity) else 0 end
                                                  as overdue_days,
    b.days_until_validity                         as due_in_days,
    b.sort_value_brl,
    'Renovar proposta ou confirmar prazo com o cliente'::text as suggested_action
  from base b
  where b.days_until_validity <= 5
)
select
  t.*,
  case t.severity when 'critical' then 0 when 'warning' then 1 else 2 end as severity_ord
from (
  select * from followup
  union all select * from stalled_neg
  union all select * from stalled_analysis
  union all select * from expiring
) t;

-- ── v_pipeline_active ─────────────────────────────────────────────────────────

create or replace view public.v_pipeline_active as
select
  q.*,
  a.legal_name                               as account_name,
  a.country,
  a.country_iso2,
  floor(extract(epoch from (now() - q.last_activity_at)) / 86400.0)::numeric
                                             as days_in_stage,
  public.quote_value_brl(q.total_value, q.currency, q.fx_to_brl)
                                             as total_value_brl,
  exists(
    select 1 from public.v_action_queue aq where aq.quote_id = q.id
  )                                          as has_active_alert,
  (
    select aq.severity from public.v_action_queue aq
    where aq.quote_id = q.id
    order by aq.severity_ord, aq.overdue_days desc, aq.sort_value_brl desc
    limit 1
  )                                          as alert_severity,
  (
    select aq.title from public.v_action_queue aq
    where aq.quote_id = q.id
    order by aq.severity_ord, aq.overdue_days desc, aq.sort_value_brl desc
    limit 1
  )                                          as alert_title
from public.quotes q
join public.accounts a on a.id = q.account_id
where q.stage not in ('won', 'lost', 'expired');

-- ── v_account_health (sem duplicar quotes por activity) ───────────────────────

create or replace view public.v_account_health as
with quote_stats as (
  select
    account_id,
    coalesce(sum(case when stage not in ('won','lost','expired','stalled')
      then total_value else 0 end), 0)            as pipeline_value_usd,
    count(*) filter (where stage not in ('won','lost','expired','stalled'))
                                                  as open_quotes,
    count(*) filter (where stage = 'won')         as won_quotes,
    count(*) filter (where stage in ('won','lost')) as decided_quotes,
    count(*)                                      as total_quotes
  from public.quotes
  group by account_id
),
activity_stats as (
  select account_id, max(occurred_at) as last_activity_at
  from public.activities
  where account_id is not null
  group by account_id
)
select
  a.id                                                    as account_id,
  a.legal_name,
  a.country,
  a.country_iso2,
  act.last_activity_at,
  coalesce(qs.pipeline_value_usd, 0)                      as pipeline_value_usd,
  case when coalesce(qs.decided_quotes, 0) > 0
    then round(coalesce(qs.won_quotes, 0)::numeric / qs.decided_quotes, 4)
    else 0
  end                                                     as hit_rate,
  coalesce(qs.open_quotes, 0)                             as open_quotes,
  coalesce(qs.won_quotes, 0)                              as won_quotes,
  coalesce(qs.total_quotes, 0)                            as total_quotes
from public.accounts a
left join quote_stats qs on qs.account_id = a.id
left join activity_stats act on act.account_id = a.id;

-- ── v_country_metrics (sem duplicar quotes × orders) ──────────────────────────

create or replace view public.v_country_metrics as
with quote_by_country as (
  select
    a.country,
    a.country_iso2,
    coalesce(sum(q.total_value), 0)             as quoted_value_usd,
    count(distinct q.id)                          as quote_count,
    count(q.id) filter (where q.stage = 'won')    as won_count,
    count(q.id) filter (where q.stage in ('won','lost')) as decided_count
  from public.accounts a
  join public.quotes q on q.account_id = a.id
    and q.received_at > now() - interval '90 days'
  where a.country_iso2 is not null
  group by a.country, a.country_iso2
),
orders_by_country as (
  select
    a.country,
    a.country_iso2,
    coalesce(sum(o.total_value), 0)             as orders_value_usd,
    count(distinct o.id)                          as order_count
  from public.accounts a
  join public.orders o on o.account_id = a.id
    and o.received_at > now() - interval '90 days'
  where a.country_iso2 is not null
  group by a.country, a.country_iso2
)
select
  coalesce(q.country, o.country)                as country,
  coalesce(q.country_iso2, o.country_iso2)      as country_iso2,
  coalesce(q.quoted_value_usd, 0)               as quoted_value_usd,
  coalesce(o.orders_value_usd, 0)              as orders_value_usd,
  case when coalesce(q.decided_count, 0) > 0
    then round(coalesce(q.won_count, 0)::numeric / q.decided_count, 4)
    else 0
  end                                           as hit_rate,
  coalesce(q.quote_count, 0)                    as quote_count,
  coalesce(o.order_count, 0)                    as order_count
from quote_by_country q
full outer join orders_by_country o
  on o.country_iso2 = q.country_iso2;

-- ── v_monthly_kpis (sem JOIN cartesiano) ──────────────────────────────────────

create or replace view public.v_monthly_kpis as
with months as (
  select date_trunc('month', d)::date as month_start
  from generate_series(
    date_trunc('month', now() - interval '12 months'),
    date_trunc('month', now()),
    interval '1 month'
  ) as d
)
select
  to_char(m.month_start, 'YYYY-MM')             as month,
  coalesce(qr.cnt, 0)                           as quotes_received,
  coalesce(qs.cnt, 0)                           as quotes_sent,
  coalesce(ord.cnt, 0)                          as orders_received,
  coalesce(qr.val, 0)                           as total_quoted_usd,
  coalesce(ord.val, 0)                          as total_ordered_usd
from months m
left join lateral (
  select count(*)::int as cnt, coalesce(sum(total_value), 0) as val
  from public.quotes
  where date_trunc('month', received_at) = m.month_start
) qr on true
left join lateral (
  select count(*)::int as cnt
  from public.quotes
  where sent_at is not null
    and date_trunc('month', sent_at) = m.month_start
) qs on true
left join lateral (
  select count(*)::int as cnt, coalesce(sum(total_value), 0) as val
  from public.orders
  where date_trunc('month', received_at) = m.month_start
) ord on true
order by m.month_start;

-- ── v_pipeline_by_account + v_executive_summary ───────────────────────────────

create or replace view public.v_pipeline_by_account as
select
  q.account_id,
  a.legal_name                                as account_name,
  a.country_iso2,
  count(q.id)                                 as open_quotes,
  coalesce(sum(q.total_value_brl), 0)         as pipeline_brl,
  coalesce(sum(
    q.total_value_brl * coalesce(q.probability, 50) / 100.0
  ), 0)                                       as pipeline_weighted_brl
from public.v_pipeline_active q
join public.accounts a on a.id = q.account_id
where q.total_value_brl is not null
group by q.account_id, a.legal_name, a.country_iso2;

create or replace view public.v_executive_summary as
select
  (select coalesce(sum(total_value_brl), 0) from public.v_pipeline_active)
                                                as pipeline_brl,
  (select coalesce(sum(
    total_value_brl * coalesce(probability, 50) / 100.0
  ), 0) from public.v_pipeline_active where total_value_brl is not null)
                                                as pipeline_weighted_brl,
  (select count(*) from public.v_pipeline_active) as open_quotes,
  (select count(*) from public.v_action_queue)  as pending_actions,
  (select count(*) from public.v_action_queue where severity = 'critical')
                                                as critical_actions,
  (
    select coalesce(sum(v), 0) from (
      select max(sort_value_brl) as v
      from public.v_action_queue
      where severity = 'critical'
      group by quote_id
    ) x
  )                                             as critical_value_brl,
  (
    select coalesce(sum(v), 0) from (
      select max(sort_value_brl) as v
      from public.v_action_queue
      group by quote_id
    ) x
  )                                             as action_value_brl,
  (
    select coalesce(max(date), '1970-01-01'::date)
    from public.fx_rates where currency = 'USD'
  )                                             as last_fx_usd_date,
  (
    select coalesce(
      round(100.0 * max(pba.pipeline_brl) / nullif(sum(pba.pipeline_brl), 0), 1),
      0
    )
    from public.v_pipeline_by_account pba
  )                                             as top_account_concentration_pct,
  (
    select account_name from public.v_pipeline_by_account
    order by pipeline_brl desc limit 1
  )                                             as top_account_name;

-- security_invoker (views recriadas)
alter view public.v_pipeline_active set (security_invoker = on);
alter view public.v_action_queue set (security_invoker = on);
alter view public.v_account_health set (security_invoker = on);
alter view public.v_country_metrics set (security_invoker = on);
alter view public.v_monthly_kpis set (security_invoker = on);
alter view public.v_pipeline_by_account set (security_invoker = on);
alter view public.v_executive_summary set (security_invoker = on);

-- === 20240101000013_probability_and_fx.sql ===

-- ─── Probabilidade efetiva por estágio + backfill ──────────────────────────────
-- Substitui o fallback fixo de 50% por defaults de negócio alinhados ao pipeline.

create or replace function public.quote_stage_default_probability(p_stage public.quote_stage)
returns int
language sql
immutable
as $$
  select case p_stage
    when 'received'     then 15
    when 'in_analysis'  then 25
    when 'sent'         then 35
    when 'negotiation'  then 55
    when 'stalled'      then 20
    when 'won'          then 100
    when 'lost'         then 0
    when 'expired'      then 0
  end;
$$;

create or replace function public.quote_effective_probability(
  p_stage       public.quote_stage,
  p_probability int
)
returns numeric
language sql
stable
as $$
  select coalesce(
    p_probability,
    public.quote_stage_default_probability(p_stage)
  )::numeric;
$$;

-- Cotações abertas sem probabilidade: preenche com default do estágio atual
update public.quotes
set probability = public.quote_stage_default_probability(stage)
where probability is null
  and stage not in ('won', 'lost', 'expired');

-- Trigger: ao mudar de estágio, se probabilidade estiver nula, aplica default
create or replace function public.apply_default_probability_on_stage()
returns trigger
language plpgsql
as $$
begin
  if new.probability is null then
    new.probability := public.quote_stage_default_probability(new.stage);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quotes_default_probability on public.quotes;
create trigger trg_quotes_default_probability
  before insert or update of stage, probability on public.quotes
  for each row execute function public.apply_default_probability_on_stage();

-- ─── Views executivas: pipeline ponderado com probabilidade efetiva ───────────

create or replace view public.v_pipeline_by_account as
select
  q.account_id,
  a.legal_name                                as account_name,
  a.country_iso2,
  count(q.id)                                 as open_quotes,
  coalesce(sum(q.total_value_brl), 0)         as pipeline_brl,
  coalesce(sum(
    q.total_value_brl
    * public.quote_effective_probability(q.stage, q.probability) / 100.0
  ), 0)                                       as pipeline_weighted_brl
from public.v_pipeline_active q
join public.accounts a on a.id = q.account_id
where q.total_value_brl is not null
group by q.account_id, a.legal_name, a.country_iso2;

create or replace view public.v_executive_summary as
select
  (select coalesce(sum(total_value_brl), 0) from public.v_pipeline_active)
                                                as pipeline_brl,
  (select coalesce(sum(
    total_value_brl
    * public.quote_effective_probability(stage, probability) / 100.0
  ), 0) from public.v_pipeline_active where total_value_brl is not null)
                                                as pipeline_weighted_brl,
  (select count(*) from public.v_pipeline_active) as open_quotes,
  (select count(*) from public.v_action_queue)  as pending_actions,
  (select count(*) from public.v_action_queue where severity = 'critical')
                                                as critical_actions,
  (
    select coalesce(sum(v), 0) from (
      select max(sort_value_brl) as v
      from public.v_action_queue
      where severity = 'critical'
      group by quote_id
    ) x
  )                                             as critical_value_brl,
  (
    select coalesce(sum(v), 0) from (
      select max(sort_value_brl) as v
      from public.v_action_queue
      group by quote_id
    ) x
  )                                             as action_value_brl,
  (
    select coalesce(max(date), '1970-01-01'::date)
    from public.fx_rates where currency = 'USD'
  )                                             as last_fx_usd_date,
  (
    select coalesce(
      round(100.0 * max(pba.pipeline_brl) / nullif(sum(pba.pipeline_brl), 0), 1),
      0
    )
    from public.v_pipeline_by_account pba
  )                                             as top_account_concentration_pct,
  (
    select account_name from public.v_pipeline_by_account
    order by pipeline_brl desc limit 1
  )                                             as top_account_name;

-- ─── run_daily_maintenance: preenche probabilidades nulas ─────────────────────

create or replace function public.run_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id         uuid;
  v_last_fx        date;
  v_stalled_before int;
  v_stalled_after  int;
  v_expired_before int;
  v_expired_after  int;
  v_prob_filled    int;
  v_details        jsonb;
begin
  insert into public.job_runs (job_name)
  values ('daily_maintenance')
  returning id into v_run_id;

  update public.quotes
  set probability = public.quote_stage_default_probability(stage)
  where probability is null
    and stage not in ('won', 'lost', 'expired');
  get diagnostics v_prob_filled = row_count;

  select count(*) into v_stalled_before from public.quotes where stage = 'stalled';
  select count(*) into v_expired_before from public.quotes where stage = 'expired';

  perform public.auto_stall_quotes();
  perform public.auto_expire_stalled();

  select count(*) into v_stalled_after from public.quotes where stage = 'stalled';
  select count(*) into v_expired_after from public.quotes where stage = 'expired';

  select max(date) into v_last_fx
  from public.fx_rates where currency = 'USD';

  v_details := jsonb_build_object(
    'stalled_quotes', v_stalled_after,
    'newly_stalled', v_stalled_after - v_stalled_before,
    'expired_quotes', v_expired_after,
    'newly_expired', v_expired_after - v_expired_before,
    'probabilities_filled', v_prob_filled,
    'pending_actions', (select count(*) from public.v_action_queue),
    'critical_actions', (select count(*) from public.v_action_queue where severity = 'critical'),
    'last_fx_usd_date', v_last_fx,
    'fx_stale', v_last_fx is null or v_last_fx < current_date - 3
  );

  update public.job_runs
  set finished_at = now(), success = true, details = v_details
  where id = v_run_id;

  return jsonb_build_object('ok', true, 'run_id', v_run_id) || v_details;
exception when others then
  update public.job_runs
  set finished_at = now(), success = false, error_message = SQLERRM
  where id = v_run_id;
  raise;
end;
$$;

alter view public.v_pipeline_by_account set (security_invoker = on);
alter view public.v_executive_summary set (security_invoker = on);

-- === 20240101000014_rename_cron_job.sql ===

-- Renomeia job de cron (marca interna, sem referência PLP)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'plp-daily-maintenance') then
    perform cron.unschedule('plp-daily-maintenance');
  end if;
  if not exists (select 1 from cron.job where jobname = 'crm-export-daily-maintenance') then
    perform cron.schedule(
      'crm-export-daily-maintenance',
      '0 10 * * *',
      $$select public.run_daily_maintenance()$$
    );
  end if;
exception
  when undefined_table then null;
  when insufficient_privilege then null;
end;
$$;

