-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table users enable row level security;
alter table accounts enable row level security;
alter table contacts enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table activities enable row level security;
alter table brain_alerts enable row level security;
alter table monthly_reports enable row level security;
alter table report_snapshots enable row level security;
alter table fx_rates enable row level security;

-- All authenticated users can SELECT / INSERT / UPDATE on all tables
-- assistant cannot DELETE quotes, orders, monthly_reports

-- Helper: is current user an owner?
create or replace function is_owner()
returns boolean language sql security definer as $$
  select exists (
    select 1 from users where id = auth.uid() and role = 'owner'
  );
$$;

-- ─── users ────────────────────────────────────────────────────────────────────
create policy "users_select" on users for select using (auth.uid() is not null);
create policy "users_insert" on users for insert with check (auth.uid() is not null);
create policy "users_update" on users for update using (auth.uid() is not null);
create policy "users_delete" on users for delete using (is_owner());

-- ─── accounts ─────────────────────────────────────────────────────────────────
create policy "accounts_select" on accounts for select using (auth.uid() is not null);
create policy "accounts_insert" on accounts for insert with check (auth.uid() is not null);
create policy "accounts_update" on accounts for update using (auth.uid() is not null);
create policy "accounts_delete" on accounts for delete using (is_owner());

-- ─── contacts ─────────────────────────────────────────────────────────────────
create policy "contacts_select" on contacts for select using (auth.uid() is not null);
create policy "contacts_insert" on contacts for insert with check (auth.uid() is not null);
create policy "contacts_update" on contacts for update using (auth.uid() is not null);
create policy "contacts_delete" on contacts for delete using (is_owner());

-- ─── quotes ───────────────────────────────────────────────────────────────────
create policy "quotes_select" on quotes for select using (auth.uid() is not null);
create policy "quotes_insert" on quotes for insert with check (auth.uid() is not null);
create policy "quotes_update" on quotes for update using (auth.uid() is not null);
create policy "quotes_delete" on quotes for delete using (is_owner());

-- ─── quote_items ──────────────────────────────────────────────────────────────
create policy "quote_items_select" on quote_items for select using (auth.uid() is not null);
create policy "quote_items_insert" on quote_items for insert with check (auth.uid() is not null);
create policy "quote_items_update" on quote_items for update using (auth.uid() is not null);
create policy "quote_items_delete" on quote_items for delete using (auth.uid() is not null);

-- ─── orders ───────────────────────────────────────────────────────────────────
create policy "orders_select" on orders for select using (auth.uid() is not null);
create policy "orders_insert" on orders for insert with check (auth.uid() is not null);
create policy "orders_update" on orders for update using (auth.uid() is not null);
create policy "orders_delete" on orders for delete using (is_owner());

-- ─── order_items ──────────────────────────────────────────────────────────────
create policy "order_items_select" on order_items for select using (auth.uid() is not null);
create policy "order_items_insert" on order_items for insert with check (auth.uid() is not null);
create policy "order_items_update" on order_items for update using (auth.uid() is not null);
create policy "order_items_delete" on order_items for delete using (auth.uid() is not null);

-- ─── activities ───────────────────────────────────────────────────────────────
create policy "activities_select" on activities for select using (auth.uid() is not null);
create policy "activities_insert" on activities for insert with check (auth.uid() is not null);
create policy "activities_update" on activities for update using (auth.uid() is not null);
create policy "activities_delete" on activities for delete using (auth.uid() is not null);

-- ─── brain_alerts ─────────────────────────────────────────────────────────────
create policy "brain_alerts_select" on brain_alerts for select using (auth.uid() is not null);
create policy "brain_alerts_insert" on brain_alerts for insert with check (auth.uid() is not null);
create policy "brain_alerts_update" on brain_alerts for update using (auth.uid() is not null);
create policy "brain_alerts_delete" on brain_alerts for delete using (is_owner());

-- ─── monthly_reports ──────────────────────────────────────────────────────────
create policy "monthly_reports_select" on monthly_reports for select using (true); -- public reports
create policy "monthly_reports_insert" on monthly_reports for insert with check (auth.uid() is not null);
create policy "monthly_reports_update" on monthly_reports for update using (auth.uid() is not null);
create policy "monthly_reports_delete" on monthly_reports for delete using (is_owner());

-- ─── report_snapshots ─────────────────────────────────────────────────────────
create policy "report_snapshots_select" on report_snapshots for select using (true);
create policy "report_snapshots_insert" on report_snapshots for insert with check (auth.uid() is not null);
create policy "report_snapshots_update" on report_snapshots for update using (is_owner());
create policy "report_snapshots_delete" on report_snapshots for delete using (is_owner());

-- ─── fx_rates ─────────────────────────────────────────────────────────────────
create policy "fx_rates_select" on fx_rates for select using (auth.uid() is not null);
create policy "fx_rates_insert" on fx_rates for insert with check (auth.uid() is not null);
create policy "fx_rates_update" on fx_rates for update using (is_owner());
create policy "fx_rates_delete" on fx_rates for delete using (is_owner());
