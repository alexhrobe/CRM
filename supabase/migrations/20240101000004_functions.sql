-- ─── auto_stall_quotes ────────────────────────────────────────────────────────
-- Marks quotes in 'sent' with no activity for >14 days as 'stalled'

create or replace function auto_stall_quotes()
returns void language plpgsql security definer as $$
begin
  update quotes
  set stage = 'stalled', updated_at = now()
  where stage = 'sent'
    and last_activity_at < now() - interval '14 days';
end;
$$;

-- ─── auto_expire_stalled ──────────────────────────────────────────────────────
-- Marks stalled quotes with no decision for >30 days as 'expired'

create or replace function auto_expire_stalled()
returns void language plpgsql security definer as $$
begin
  update quotes
  set stage = 'expired', updated_at = now()
  where stage = 'stalled'
    and last_activity_at < now() - interval '30 days'
    and decided_at is null;
end;
$$;

-- ─── Schedule functions via pg_cron (if available) ───────────────────────────
-- These will be managed via Edge Functions instead if pg_cron not available

-- ─── Helper: get current FX rate ─────────────────────────────────────────────

create or replace function get_fx_rate(p_currency text, p_date date default current_date)
returns decimal(10,4) language sql stable as $$
  select rate_to_brl
  from fx_rates
  where currency = p_currency
    and date <= p_date
  order by date desc
  limit 1;
$$;
