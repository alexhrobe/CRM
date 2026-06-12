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
