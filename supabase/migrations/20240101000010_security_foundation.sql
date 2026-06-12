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
