# 3. Type-safety ponta a ponta a partir do schema

- **Status:** Aceito
- **Data:** 2026-06-01

## Contexto

As queries ao Supabase eram feitas com o client sem genéricos, então `data`
chegava como `any`. Resultado: nenhuma proteção entre o schema do Postgres e o
código React. Colunas renomeadas, enums errados ou campos ausentes só
apareceriam em produção. (Um sintoma disso: dezenas de `implicit any` em hooks
e páginas.)

## Decisão

Tipar o client com o schema do banco: `createClient<Database>(...)`, onde
`Database` (em `apps/web/src/lib/database.types.ts`) espelha as migrations no
mesmo formato de `supabase gen types typescript`. Inclui Row/Insert/Update por
tabela, views, funções RPC, enums e **Relationships** — o que permite que os
embeds (`quotes → account/items/activities`) sejam inferidos sem casts.

Onde o dado é genuinamente dinâmico (jsonb de `report_snapshots`), o contrato é
declarado em `@crm-plp/shared` (ex.: `ReportKpis`) e aplicado por cast no ponto
de leitura. A tradução UI→enum fica contida no boundary (ex.: `useUpdateQuoteStage`).

## Consequências

- ✅ Erros de schema viram erros de compilação; o CI bloqueia o merge.
- ✅ Autocomplete real de colunas/relacionamentos no editor.
- ✅ Eliminou os `implicit any` de queries.
- ⚠️ `database.types.ts` precisa ser regenerado quando o schema muda
  (`supabase gen types typescript --linked`). Migration sem regenerar = drift.
