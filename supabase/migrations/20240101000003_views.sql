-- ─── v_pipeline_active ────────────────────────────────────────────────────────

create or replace view v_pipeline_active as
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
    select 1 from brain_alerts ba
    where ba.quote_id = q.id
      and ba.dismissed = false
      and (ba.expires_at is null or ba.expires_at > now())
  )                                          as has_active_alert,
  (
    select ba.severity from brain_alerts ba
    where ba.quote_id = q.id
      and ba.dismissed = false
      and (ba.expires_at is null or ba.expires_at > now())
    order by
      case ba.severity when 'critical' then 1 when 'warning' then 2 else 3 end
    limit 1
  )                                          as alert_severity,
  (
    select ba.title from brain_alerts ba
    where ba.quote_id = q.id
      and ba.dismissed = false
      and (ba.expires_at is null or ba.expires_at > now())
    order by
      case ba.severity when 'critical' then 1 when 'warning' then 2 else 3 end
    limit 1
  )                                          as alert_title
from quotes q
join accounts a on a.id = q.account_id
where q.stage not in ('won', 'lost', 'expired');

-- ─── v_account_health ─────────────────────────────────────────────────────────

create or replace view v_account_health as
select
  a.id                                                    as account_id,
  a.legal_name,
  a.country,
  a.country_iso2,
  max(act.occurred_at)                                    as last_activity_at,
  coalesce(sum(case when q.stage not in ('won','lost','expired','stalled')
    then q.total_value else 0 end), 0)                    as pipeline_value_usd,
  case when count(q.id) filter (where q.stage in ('won','lost')) > 0
    then round(count(q.id) filter (where q.stage = 'won')::numeric /
         count(q.id) filter (where q.stage in ('won','lost')), 4)
    else 0
  end                                                     as hit_rate,
  count(q.id) filter (where q.stage not in ('won','lost','expired','stalled')) as open_quotes,
  count(q.id) filter (where q.stage = 'won')              as won_quotes,
  count(q.id)                                             as total_quotes
from accounts a
left join quotes q on q.account_id = a.id
left join activities act on act.account_id = a.id
group by a.id, a.legal_name, a.country, a.country_iso2;

-- ─── v_country_metrics ────────────────────────────────────────────────────────

create or replace view v_country_metrics as
select
  a.country,
  a.country_iso2,
  coalesce(sum(q.total_value), 0)                         as quoted_value_usd,
  coalesce(sum(case when o.id is not null then o.total_value else 0 end), 0) as orders_value_usd,
  case when count(q.id) filter (where q.stage in ('won','lost')) > 0
    then round(count(q.id) filter (where q.stage = 'won')::numeric /
         count(q.id) filter (where q.stage in ('won','lost')), 4)
    else 0
  end                                                     as hit_rate,
  count(distinct q.id)                                    as quote_count,
  count(distinct o.id)                                    as order_count
from accounts a
left join quotes q on q.account_id = a.id
  and q.received_at > now() - interval '90 days'
left join orders o on o.account_id = a.id
  and o.received_at > now() - interval '90 days'
where a.country_iso2 is not null
group by a.country, a.country_iso2;

-- ─── v_monthly_kpis ───────────────────────────────────────────────────────────

create or replace view v_monthly_kpis as
select
  to_char(month_series, 'YYYY-MM')                        as month,
  count(q.id) filter (
    where to_char(q.received_at, 'YYYY-MM') = to_char(month_series, 'YYYY-MM')
  )                                                       as quotes_received,
  count(q.id) filter (
    where to_char(q.sent_at, 'YYYY-MM') = to_char(month_series, 'YYYY-MM')
  )                                                       as quotes_sent,
  count(o.id) filter (
    where to_char(o.received_at, 'YYYY-MM') = to_char(month_series, 'YYYY-MM')
  )                                                       as orders_received,
  coalesce(sum(q.total_value) filter (
    where to_char(q.received_at, 'YYYY-MM') = to_char(month_series, 'YYYY-MM')
  ), 0)                                                   as total_quoted_usd,
  coalesce(sum(o.total_value) filter (
    where to_char(o.received_at, 'YYYY-MM') = to_char(month_series, 'YYYY-MM')
  ), 0)                                                   as total_ordered_usd
from generate_series(
  date_trunc('month', now() - interval '12 months'),
  date_trunc('month', now()),
  interval '1 month'
) as month_series
left join quotes q on true
left join orders o on true
group by month_series
order by month_series;
