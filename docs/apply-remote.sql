-- ════════════════════════════════════════════════════════════════════════════
-- Aplicar no Supabase remoto (SQL Editor) ANTES do deploy real.
-- Contém as migrations novas desta fase: 0007 (RLS hardening) e 0008 (RFQ).
-- Idempotente o suficiente para o estado atual; se já tiver sido aplicado,
-- alguns comandos podem acusar "already exists" — pode ignorar nesse caso.
-- Pré-requisito: o schema base (0001–0006) já deve existir no projeto.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 0007: RLS hardening ──────────────────────────────────────────────────────
create or replace function public.is_owner()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'owner');
$$;

drop policy if exists "users_update" on public.users;
create policy "users_update" on public.users
  for update using (is_owner() or id = auth.uid()) with check (is_owner() or id = auth.uid());

create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Apenas um owner pode alterar o papel (role) de um usuário';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_role_escalation on public.users;
create trigger trg_prevent_role_escalation
  before update on public.users for each row execute function public.prevent_role_escalation();

drop policy if exists "users_insert" on public.users;
create policy "users_insert" on public.users
  for insert with check (is_owner() or id = auth.uid());

drop policy if exists "monthly_reports_select" on public.monthly_reports;
create policy "monthly_reports_select" on public.monthly_reports
  for select using (published = true or auth.uid() is not null);

drop policy if exists "report_snapshots_select" on public.report_snapshots;
create policy "report_snapshots_select" on public.report_snapshots
  for select using (
    auth.uid() is not null
    or exists (select 1 from public.monthly_reports mr where mr.id = report_snapshots.report_id and mr.published = true)
  );

-- ─── 0008: Solicitações de orçamento (RFQ) ────────────────────────────────────
do $$ begin
  create type request_status as enum ('new', 'quoting', 'quoted', 'discarded');
exception when duplicate_object then null; end $$;

create table if not exists quote_requests (
  id          uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  from_name   text,
  from_email  text,
  subject     text,
  body        text,
  account_id  uuid references accounts(id) on delete set null,
  quote_id    uuid references quotes(id) on delete set null,
  status      request_status not null default 'new',
  source      text not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_quote_requests_updated_at on quote_requests;
create trigger trg_quote_requests_updated_at
  before update on quote_requests for each row execute function set_updated_at();

create index if not exists idx_quote_requests_received on quote_requests(received_at);
create index if not exists idx_quote_requests_status on quote_requests(status);

alter table quote_requests enable row level security;
drop policy if exists "quote_requests_select" on quote_requests;
create policy "quote_requests_select" on quote_requests for select using (auth.uid() is not null);
drop policy if exists "quote_requests_insert" on quote_requests;
create policy "quote_requests_insert" on quote_requests for insert with check (auth.uid() is not null);
drop policy if exists "quote_requests_update" on quote_requests;
create policy "quote_requests_update" on quote_requests for update using (auth.uid() is not null);
drop policy if exists "quote_requests_delete" on quote_requests;
create policy "quote_requests_delete" on quote_requests for delete using (is_owner());
