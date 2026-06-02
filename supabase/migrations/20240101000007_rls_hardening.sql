-- ─── RLS hardening ────────────────────────────────────────────────────────────
-- Corrige achados da auditoria de segurança (ver SECURITY.md):
--   1. Escalonamento de privilégio: qualquer usuário podia mudar o próprio role.
--   2. is_owner() SECURITY DEFINER sem search_path fixo (hijacking).
--   3. Relatórios não publicados expostos publicamente.
-- Migration aditiva: substitui apenas as policies/funções afetadas.

-- ── 1. is_owner(): fixar search_path ─────────────────────────────────────────
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'owner'
  );
$$;

-- ── 2. users: impedir auto-escalonamento de papel ────────────────────────────
-- Antes: UPDATE liberado a qualquer autenticado, em qualquer linha, inclusive
-- a coluna role. Um assistant podia se promover a owner.
-- Agora: owner edita qualquer linha; usuário comum edita só a própria; e a
-- troca de role só é permitida a um owner (garantida por trigger, já que RLS
-- não compara OLD/NEW).

drop policy if exists "users_update" on public.users;
create policy "users_update" on public.users
  for update
  using (is_owner() or id = auth.uid())
  with check (is_owner() or id = auth.uid());

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Apenas um owner pode alterar o papel (role) de um usuário';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.users;
create trigger trg_prevent_role_escalation
  before update on public.users
  for each row execute function public.prevent_role_escalation();

-- INSERT direto em users só para si mesmo ou owner (a criação normal acontece
-- via trigger handle_new_user, que roda como definer e não passa por esta policy).
drop policy if exists "users_insert" on public.users;
create policy "users_insert" on public.users
  for insert
  with check (is_owner() or id = auth.uid());

-- ── 3. Relatórios: público só enxerga o que foi publicado ────────────────────
-- Antes: select using(true) expunha rascunhos (receita, pipeline por país,
-- top deals). Agora: autenticado vê tudo; anônimo só o que tem published = true.

drop policy if exists "monthly_reports_select" on public.monthly_reports;
create policy "monthly_reports_select" on public.monthly_reports
  for select
  using (published = true or auth.uid() is not null);

drop policy if exists "report_snapshots_select" on public.report_snapshots;
create policy "report_snapshots_select" on public.report_snapshots
  for select
  using (
    auth.uid() is not null
    or exists (
      select 1 from public.monthly_reports mr
      where mr.id = report_snapshots.report_id
        and mr.published = true
    )
  );
