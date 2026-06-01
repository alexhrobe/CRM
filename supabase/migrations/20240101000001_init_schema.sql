-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Custom types ─────────────────────────────────────────────────────────────

create type user_role as enum ('owner', 'assistant');
create type account_type as enum ('direct_customer', 'subsidiary', 'distributor', 'representative', 'partner');
create type quote_type as enum ('competitive', 'reposition');
create type quote_stage as enum ('received', 'in_analysis', 'sent', 'negotiation', 'won', 'lost', 'expired', 'stalled');
create type product_group as enum ('preformados', 'cadeias', 'svd_amortecedor', 'opgw_fibra', 'cruzeta', 'ferragens', 'isoladores', 'conectores', 'outros');
create type loss_reason as enum ('price', 'lead_time', 'competitor', 'specification', 'no_response', 'customer_canceled', 'other');
create type order_status as enum ('received', 'in_production', 'shipped', 'delivered', 'canceled');
create type activity_kind as enum ('call', 'email_sent', 'email_received', 'meeting', 'note', 'task', 'system_event');
create type alert_type as enum ('cooling_quote', 'stalled_high_value', 'pattern_anomaly', 'opportunity', 'deadline_risk', 'unusual_drop');
create type alert_severity as enum ('info', 'warning', 'critical');

-- ─── Utility function for updated_at ─────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── users ────────────────────────────────────────────────────────────────────

create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  role        user_role not null default 'assistant',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- Auto-insert on auth signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email, ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'assistant')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── accounts ─────────────────────────────────────────────────────────────────

create table accounts (
  id                 uuid primary key default gen_random_uuid(),
  legal_name         text not null,
  country            text not null,
  country_iso2       text,
  account_type       account_type not null default 'direct_customer',
  currency_default   text not null default 'USD',
  parent_account_id  uuid references accounts(id) on delete set null,
  segment            text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_accounts_updated_at
  before update on accounts
  for each row execute function set_updated_at();

create index idx_accounts_country on accounts(country_iso2);

-- ─── contacts ─────────────────────────────────────────────────────────────────

create table contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  role        text,
  email       text,
  phone       text,
  language    text not null default 'es',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_contacts_updated_at
  before update on contacts
  for each row execute function set_updated_at();

create index idx_contacts_account on contacts(account_id);

-- ─── quotes ───────────────────────────────────────────────────────────────────

create table quotes (
  id                     uuid primary key default gen_random_uuid(),
  account_id             uuid not null references accounts(id),
  owner_id               uuid not null references users(id),
  assistant_id           uuid references users(id),
  quote_number           text unique not null,
  quote_type             quote_type not null,
  stage                  quote_stage not null default 'received',
  total_value            decimal(14,2),
  currency               text not null default 'USD',
  fx_to_brl              decimal(10,4),
  probability            int check (probability between 0 and 100),
  product_group          product_group,
  product_description    text,
  received_at            timestamptz not null,
  sent_at                timestamptz,
  expected_close_at      date,
  decided_at             timestamptz,
  loss_reason            loss_reason,
  loss_competitor        text,
  loss_notes             text,
  commission_pct_ds      decimal(5,4) not null default 0,
  commission_pct_dfj     decimal(5,4) not null default 0,
  commission_pct_other   decimal(5,4) not null default 0,
  commission_other_label text,
  last_activity_at       timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_quotes_updated_at
  before update on quotes
  for each row execute function set_updated_at();

create index idx_quotes_account on quotes(account_id);
create index idx_quotes_stage on quotes(stage);
create index idx_quotes_received_at on quotes(received_at desc);
create index idx_quotes_last_activity on quotes(last_activity_at);

-- ─── quote_items ──────────────────────────────────────────────────────────────

create table quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references quotes(id) on delete cascade,
  product_code text,
  description  text,
  quantity     decimal(12,3),
  unit_price   decimal(12,4),
  total        decimal(14,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_quote_items_updated_at
  before update on quote_items
  for each row execute function set_updated_at();

create index idx_quote_items_quote on quote_items(quote_id);

-- ─── orders ───────────────────────────────────────────────────────────────────

create table orders (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references accounts(id),
  quote_id              uuid references quotes(id) on delete set null,
  po_number             text,
  internal_number       text,
  status                order_status not null default 'received',
  total_value           decimal(14,2) not null,
  currency              text not null,
  fx_to_brl             decimal(10,4) not null,
  received_at           timestamptz not null,
  promised_delivery_at  date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

create index idx_orders_account on orders(account_id);
create index idx_orders_status on orders(status);

-- ─── order_items ──────────────────────────────────────────────────────────────

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  product_code text,
  description  text,
  quantity     decimal(12,3),
  unit_price   decimal(12,4),
  total        decimal(14,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_order_items_updated_at
  before update on order_items
  for each row execute function set_updated_at();

-- ─── activities ───────────────────────────────────────────────────────────────

create table activities (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references accounts(id),
  quote_id      uuid references quotes(id) on delete set null,
  order_id      uuid references orders(id) on delete set null,
  contact_id    uuid references contacts(id) on delete set null,
  user_id       uuid not null references users(id),
  kind          activity_kind not null,
  title         text,
  body          text,
  due_at        timestamptz,
  completed_at  timestamptz,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_activities_updated_at
  before update on activities
  for each row execute function set_updated_at();

create index idx_activities_account on activities(account_id);
create index idx_activities_quote on activities(quote_id);
create index idx_activities_occurred on activities(occurred_at desc);

-- Trigger: update last_activity_at on quote when activity inserted
create or replace function update_quote_last_activity()
returns trigger language plpgsql as $$
begin
  if new.quote_id is not null then
    update quotes set last_activity_at = now() where id = new.quote_id;
  end if;
  return new;
end;
$$;

create trigger trg_activity_update_quote
  after insert on activities
  for each row execute function update_quote_last_activity();

-- ─── brain_alerts ─────────────────────────────────────────────────────────────

create table brain_alerts (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid references accounts(id) on delete cascade,
  quote_id         uuid references quotes(id) on delete cascade,
  alert_type       alert_type not null,
  severity         alert_severity not null,
  title            text not null,
  body             text not null,
  suggested_action text,
  suggested_prompt text,
  dismissed        boolean not null default false,
  dismissed_at     timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_brain_alerts_updated_at
  before update on brain_alerts
  for each row execute function set_updated_at();

create index idx_brain_alerts_active on brain_alerts(dismissed, expires_at);
create index idx_brain_alerts_quote on brain_alerts(quote_id);

-- ─── monthly_reports ──────────────────────────────────────────────────────────

create table monthly_reports (
  id           uuid primary key default gen_random_uuid(),
  period       text not null,
  slug         text unique not null,
  title        text not null,
  narrative    text,
  published    boolean not null default false,
  published_at timestamptz,
  created_by   uuid not null references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_monthly_reports_updated_at
  before update on monthly_reports
  for each row execute function set_updated_at();

-- ─── report_snapshots ─────────────────────────────────────────────────────────

create table report_snapshots (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references monthly_reports(id) on delete cascade,
  metric_key  text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_report_snapshots_updated_at
  before update on report_snapshots
  for each row execute function set_updated_at();

create unique index idx_report_snapshots_unique on report_snapshots(report_id, metric_key);

-- ─── fx_rates ─────────────────────────────────────────────────────────────────

create table fx_rates (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  currency     text not null,
  rate_to_brl  decimal(10,4) not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(date, currency)
);

create trigger trg_fx_rates_updated_at
  before update on fx_rates
  for each row execute function set_updated_at();
