# Segurança — CRM PLP Export

Modelo de ameaça, decisões de autorização e registro de auditoria do sistema.
A autorização vive no **banco** (RLS), não no frontend — o cliente nunca é a
fronteira de confiança.

---

## Modelo de confiança

| Ator | Como autentica | O que pode |
|---|---|---|
| **owner** | JWT (GoTrue) | tudo, incluindo DELETE e gestão de papéis |
| **assistant** | JWT (GoTrue) | SELECT/INSERT/UPDATE; **não** pode DELETE em quotes/orders/reports nem alterar papéis |
| **anônimo** | sem sessão | apenas relatórios **publicados** (`/r/:slug`) |
| **service role** | secret (Edge Functions/cron) | bypassa RLS; nunca exposto ao browser |

Papéis são de aplicação (coluna `users.role`), resolvidos via `is_owner()`, e
não papéis nativos do Postgres — todos os usuários logados são `authenticated`.

---

## Auditoria — 2026-06-01

Revisão das políticas RLS (`migrations/...0002_rls.sql`) e das Edge Functions.
Correções aplicadas em `...0007_rls_hardening.sql`.

### 🔴 Crítico — escalonamento de privilégio via `users`
A policy `users_update` usava `using (auth.uid() is not null)`, liberando UPDATE
de **qualquer** linha de `users` a qualquer autenticado — inclusive a coluna
`role`. Um `assistant` podia executar `update users set role='owner'` e se
promover, anulando toda a distinção de papéis.

**Correção:** UPDATE restrito a owner (qualquer linha) ou ao próprio usuário
(sua linha); troca de `role` bloqueada para não-owners por trigger
(`prevent_role_escalation`), já que RLS não compara OLD/NEW. INSERT direto
também restrito (a criação normal é via trigger `handle_new_user`).

### 🟠 Médio — `is_owner()` com search_path mutável
Função `SECURITY DEFINER` sem `set search_path`, vetor de *search_path hijacking*
(o mesmo problema corrigido para `handle_new_user` na migration 0005). É também
um aviso do linter do Supabase.

**Correção:** recriada com `set search_path = public` e referências
totalmente qualificadas (`public.users`).

### 🟠 Médio — rascunhos de relatório expostos publicamente
`monthly_reports` e `report_snapshots` tinham `select using (true)`, expondo
relatórios **não publicados** (receita, pipeline por país, principais negócios)
a qualquer um — a flag `published` era ignorada.

**Correção:** anônimo enxerga apenas `published = true`; autenticados continuam
vendo tudo (preview interno antes de publicar).

### 🔵 Info — Edge Functions
`close-month` valida o chamador (`auth.getUser` → 401 sem sessão) e usa service
role apenas internamente para agregar. `verify_jwt` permanece no padrão (true)
por não haver override em `config.toml`. Sem ação.

---

## Boas práticas em vigor

- RLS habilitada em **todas** as tabelas; DELETE sensível restrito a owner.
- Segredos (`ANTHROPIC_API_KEY`, service role) só em Edge Functions, nunca no
  bundle do cliente (`.gitignore` cobre `.env*`).
- Funções `SECURITY DEFINER` com `search_path` fixo.

## Como reportar

Encontrou algo? Abra uma issue privada ou contate o mantenedor. Não publique
detalhes exploráveis antes da correção.

> **Validação:** as correções de RLS foram revisadas estaticamente. Validação em
> runtime: `supabase db reset` + testes de policy por papel (pendente de ambiente
> com Docker).
