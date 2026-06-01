# 2. Supabase como backend (Postgres + Auth + Edge Functions)

- **Status:** Aceito
- **Data:** 2026-06-01

## Contexto

O produto é operado por uma equipe pequena (owner + assistente) e precisa de
banco relacional, autenticação, autorização por papel, tempo real e um lugar
para rodar lógica assíncrona com segredos (chave da Anthropic). Construir e
operar essa stack do zero seria caro para o tamanho do time.

## Decisão

Adotar **Supabase** como plataforma única:
- **Postgres** como fonte de verdade, com regras de negócio próximas do dado
  (views, funções, triggers).
- **GoTrue** para autenticação por e-mail/senha (JWT).
- **RLS** como camada de autorização — as políticas vivem no banco, não no
  frontend.
- **Edge Functions (Deno)** para trabalho assíncrono e chamadas com segredo.

## Consequências

- ✅ Uma stack, um deploy, um modelo mental; RLS centraliza a autorização.
- ✅ Realtime e Storage inclusos sem servidor próprio.
- ⚠️ Acoplamento ao Supabase (mitigado: é Postgres padrão + Deno padrão).
- ⚠️ Lógica em SQL/Deno exige testar migrations e funções com cuidado.
