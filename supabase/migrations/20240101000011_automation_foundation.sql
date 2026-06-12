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
