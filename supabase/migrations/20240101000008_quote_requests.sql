-- ─── Solicitações de orçamento (RFQ) ──────────────────────────────────────────
-- Fila de pedidos recebidos (por e-mail/manual) ANTES de virarem cotação.
-- Ordem de chegada (received_at). Ao converter, vincula-se à cotação criada.

create type request_status as enum ('new', 'quoting', 'quoted', 'discarded');

create table quote_requests (
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

create trigger trg_quote_requests_updated_at
  before update on quote_requests
  for each row execute function set_updated_at();

create index idx_quote_requests_received on quote_requests(received_at);
create index idx_quote_requests_status on quote_requests(status);

alter table quote_requests enable row level security;

create policy "quote_requests_select" on quote_requests for select using (auth.uid() is not null);
create policy "quote_requests_insert" on quote_requests for insert with check (auth.uid() is not null);
create policy "quote_requests_update" on quote_requests for update using (auth.uid() is not null);
create policy "quote_requests_delete" on quote_requests for delete using (is_owner());
