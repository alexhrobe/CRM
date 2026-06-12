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
