# 4. Inteligência (Claude) em Edge Functions assíncronas

- **Status:** Aceito
- **Data:** 2026-06-01

## Contexto

A camada de IA (alertas do pipeline, scoring, drafts, narrativa do relatório)
depende da chave da Anthropic — que **não pode** ser exposta no frontend — e de
chamadas que podem levar segundos, longas demais para o caminho de renderização
da UI.

## Decisão

Rodar toda interação com o Claude em **Edge Functions** (`brain-scan`,
`score-quote`, `generate-followup-draft`, `close-month`), com a chave guardada
como secret do Supabase. As funções periódicas (`brain-scan`, `import-fx-rates`)
são acionadas por `pg_cron`/Schedules; as sob demanda são invocadas pela SPA.

A priorização do Inbox (`priorityScore`) é **determinística e roda no cliente** —
não gasta tokens e é coberta por testes unitários. A IA enriquece (alertas,
texto), mas não é caminho crítico para a tela carregar.

## Consequências

- ✅ Segredo isolado do browser; latência de IA fora do render.
- ✅ Ordenação do pipeline previsível e testável, independente da IA.
- ✅ Custo de IA concentrado em jobs agendados, não a cada pageview.
- ⚠️ Funções de IA precisam de timeout, retry e tratamento de falha do provedor.
- ⚠️ Saída do modelo é não-determinística: validar/limitar antes de persistir.
