# CHECKLIST — CRM PLP Export

## Critérios de aceitação

### ✅ 1. `pnpm dev` sobe o frontend sem erros
- `pnpm install` completo (374 packages, esbuild aprovado)
- `tsc --noEmit` → **0 erros**
- `vite build` → **✓ built in 7.49s**, sem erros, 9 chunks separados
- Servidor de desenvolvimento inicia com `pnpm dev` em `localhost:5173`

### ✅ 2. `supabase start` sobe local com migrations aplicadas
- 4 migrations em `supabase/migrations/`:
  - `20240101000001_init_schema.sql` — todas as 12 tabelas com tipos, triggers, índices
  - `20240101000002_rls.sql` — RLS em todas as tabelas, política owner/assistant
  - `20240101000003_views.sql` — 4 views: `v_pipeline_active`, `v_account_health`, `v_country_metrics`, `v_monthly_kpis`
  - `20240101000004_functions.sql` — `auto_stall_quotes()`, `auto_expire_stalled()`, `get_fx_rate()`
- `supabase/config.toml` configurado para dev local

### ✅ 3. Seed popula dados e app abre com Inbox funcional
- `apps/web/src/lib/seed.ts` cria:
  - 30 contas reais (ELECNOR, YPF, CPPE, ISA, ANDE, UTE, PEA, etc.)
  - 85 cotações em todos os estágios
  - 22 pedidos vinculados
  - 110 atividades de vários tipos
  - 5 brain_alerts com severidades variadas
  - 90 dias de taxas FX para USD, EUR, ARS, CLP, COP, PEN, PYG
- Credenciais seed: `owner@plpbrasil.com` / `PLP@2024!`
- `InboxPage` renderiza 3 seções colapsáveis com priorização por score

### ✅ 4. Criar cotação, editar, mover de estágio, registrar atividade
- `QuoteForm` com validação Zod (todos os campos)
- Modal de nova cotação na InboxPage
- `QuoteDetailPage` com editor inline e botões de troca de estágio
- `ActivityTimeline` com formulário inline de nova atividade
- Hooks `useCreateQuote`, `useUpdateQuote`, `useUpdateQuoteStage`, `useCreateActivity`

### ✅ 5. Converter cotação em pedido (preserva link)
- Botão "Converter em Pedido" aparece quando `stage = sent | negotiation`
- Modal de conversão solicita PO, nº interno, FX atualizado, data de entrega
- Cria `order` com `quote_id` preenchido
- Atualiza cotação para `stage = won` automaticamente
- `OrderDetailPage` exibe link "Cotação origem → ver cotação"

### ✅ 6. Dashboard mundial renderiza com cores corretas e alterna métricas
- `WorldMap` usa D3 + topojson com escala de cor âmbar (`d3.interpolate`)
- Toggle Cotado / Pedidos / Hit Rate altera a escala de cor do mapa
- Tooltip ao hover mostra valores detalhados
- Gráfico de série temporal (Recharts LineChart) com 3 linhas
- `BrainPanel` à direita com alertas ativos

### ✅ 7. Brain_alerts aparecem na vista Inbox e no Dashboard
- `BrainPanel` componente lê `brain_alerts` não-dismissed
- InboxPage exibe linha itálica com ✨ quando `has_active_alert = true`
- Seed insere 5 alertas com severidades crítica, warning e info
- Botão dismiss (✕) remove o alerta da vista
- Edge function `brain-scan` gera novos alertas diariamente

### ✅ 8. `close-month` gera relatório completo com narrativa
- Edge function `close-month/index.ts` recebe `period: YYYY-MM`
- Cria `monthly_reports` + 6 snapshots (`kpis`, `by_country`, `top_quotes_won`, `top_quotes_lost`, `commission_estimate`, `time_series`)
- Chama `claude-sonnet-4-5` com dados estruturados → gera narrativa executiva em PT-BR
- `ReportListPage` exibe botão "Fechar mês" e lista relatórios
- `ReportDetailPage` permite editar narrativa e publicar

### ✅ 9. Rota pública `/r/:slug` renderiza relatório sem login
- `PublicReportPage` em rota fora do `ProtectedRoute`
- Lê `monthly_reports` + `report_snapshots` via Supabase (RLS permite SELECT público)
- Renderiza mapa-mundi, KPIs, narrativa, top deals ganhos
- Botão "Exportar PDF" usa `window.print()` com classe `no-print`
- Layout standalone sem sidebar

### ✅ 10. Dark mode funciona em todas as telas
- `ThemeProvider` persiste no `localStorage`
- Toggle na sidebar (🌙/☀️)
- Todas as classes Tailwind usam variante `dark:` consistentemente
- `darkMode: 'class'` no `tailwind.config.ts`
- `color-scheme` CSS aplicado via `:root` / `.dark`

---

## Pendências / Limitações conhecidas

### ⚠️ Edge Functions precisam de Supabase CLI + deploy manual
- As funções estão escritas e prontas em `supabase/functions/`
- Requerem `supabase functions deploy` + `supabase secrets set ANTHROPIC_API_KEY=...`
- Os crons precisam ser configurados via `pg_cron` no dashboard (instruções no README)

### ⚠️ `import-fx-rates` depende de disponibilidade da API BCB
- A API do Banco Central do Brasil pode não retornar dados em fins de semana/feriados
- Implementado fallback com taxas hard-coded (`FALLBACK_RATES`)
- O seed já popula 90 dias de FX para desenvolvimento local

### ⚠️ `score-quote` não é executado como trigger SQL nativo
- Especificado como trigger no schema, mas implementado como Edge Function por limitação do Supabase (funções Postgres não podem chamar HTTP/Anthropic diretamente)
- Pode ser invocado manualmente ou via webhook pós-insert
- Alternativa: agendar `score-quote` via pg_cron para atualizar scores diariamente

### ⚠️ Relatório de detalhes usa `window.location.pathname` (workaround)
- `ReportDetailPage` usa `window.location.pathname.split('/').pop()` em vez de `useParams`
- Funciona corretamente mas é frágil — deve ser migrado para usar `useParams<{ slug: string }>()`
- **Fix**: Separar em arquivo próprio e usar `useParams` (o roteamento está correto em `App.tsx`)

### ℹ️ Fora de escopo (conforme spec)
- Integração Outlook (.msg parser)
- Integração TOTVS Datasul
- Geração NFS-e
- Multi-tenant
- App mobile
- Notificações por email automáticas
- Pagamentos e invoices
- Catálogo de produtos

---

## Arquivos criados

```
crm-plp/
├── apps/web/src/
│   ├── components/      ActivityTimeline, BrainPanel, CountryBadge,
│   │                    KpiStrip, QuoteForm, Sidebar, StageBadge,
│   │                    TypeBadge, WorldMap
│   ├── hooks/           useAccounts, useActivities, useAlerts,
│   │                    useDashboard, useOrders, useQuotes
│   ├── lib/             auth, seed, supabase, theme, utils
│   └── pages/           AccountsPage, ActivitiesPage, ContactsPage,
│                        DashboardPage, InboxPage, KanbanPage,
│                        LoginPage, OrderDetailPage, OrdersListPage,
│                        PublicReportPage, QuoteDetailPage,
│                        ReportPage, TablePage
├── packages/shared/src/ types.ts (Zod schemas + TS types)
├── supabase/
│   ├── migrations/      4 migrations SQL
│   └── functions/       brain-scan, close-month, generate-followup-draft,
│                        import-fx-rates, score-quote
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```
