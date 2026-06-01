# CRM PLP Export

Sistema de gestão de cotações e pedidos de exportação da PLP Brasil.

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Edge Functions + Realtime)
- **IA**: Anthropic Claude (`claude-sonnet-4-5`)
- **Mapas**: D3.js + topojson
- **Deploy**: Vercel (frontend) + Supabase Cloud (backend)

---

## Setup local

### Pré-requisitos

- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 1.170
- Docker Desktop (para `supabase start`)

### 1. Clonar e instalar dependências

```bash
git clone <repo>
cd crm-plp
pnpm install
```

### 2. Variáveis de ambiente

```bash
cp .env.example apps/web/.env.local
```

Edite `apps/web/.env.local` com os valores do seu projeto Supabase.

Para desenvolvimento local:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<chave-anon-do-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<service-role-do-supabase-start>
```

### 3. Subir Supabase local

```bash
supabase start
```

Isso inicia Postgres, Auth, Storage e Studio. Na primeira vez, aguarde o pull das imagens Docker (~2min).

### 4. Aplicar migrations

```bash
supabase db push
```

Ou para dev local:
```bash
supabase db reset   # aplica todas as migrations do zero
```

### 5. Rodar o frontend

```bash
pnpm dev
```

Acessa em `http://localhost:5173`.

---

## Criar usuários iniciais

### Via Supabase Studio (local)

1. Abra `http://localhost:54323` (Studio)
2. Vá em **Authentication → Users → Add user**
3. Crie dois usuários:
   - `owner@plpbrasil.com` — senha forte — metadata: `{"name": "Admin PLP", "role": "owner"}`
   - `assistente@plpbrasil.com` — senha forte — metadata: `{"name": "Assistente", "role": "assistant"}`

### Via CLI (script seed — faz isso automaticamente)

```bash
pnpm seed
```

---

## Rodar o seed

O seed popula o banco com dados realistas para demonstração:
- 30 contas (ELECNOR, YPF, CPPE, ISA, etc.)
- 85 cotações em vários estágios
- 22 pedidos
- 110 atividades
- 5 brain_alerts
- 90 dias de taxas FX

```bash
# Certifique-se de ter SUPABASE_SERVICE_ROLE_KEY em apps/web/.env.local
pnpm seed
```

**Credenciais criadas pelo seed:**
```
Email:    owner@plpbrasil.com
Senha:    PLP@2024!
```

---

## Deploy Edge Functions

```bash
# Login no Supabase Cloud
supabase login

# Linkar ao projeto remoto
supabase link --project-ref <seu-project-ref>

# Deploy de todas as funções
supabase functions deploy brain-scan
supabase functions deploy generate-followup-draft
supabase functions deploy score-quote
supabase functions deploy close-month
supabase functions deploy import-fx-rates

# Configurar secrets
supabase secrets set ANTHROPIC_API_KEY=<sua-chave>
```

---

## Agendar crons

Os crons são configurados via **Supabase Dashboard → Database → Extensions → pg_cron**
ou via SQL no Supabase Studio.

### Habilitar pg_cron

```sql
create extension if not exists pg_cron;
```

### Brain Scan (diário às 07:00 BRT)

```sql
select cron.schedule(
  'brain-scan-daily',
  '0 10 * * *',   -- 10:00 UTC = 07:00 BRT
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/brain-scan',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Import FX Rates (diário às 13:30 BRT — após fechamento PTAX)

```sql
select cron.schedule(
  'import-fx-rates-daily',
  '30 16 * * 1-5',  -- 16:30 UTC = 13:30 BRT, dias úteis
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/import-fx-rates',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Alternativa:** Use o Supabase Dashboard → Edge Functions → cada função → aba **Schedules**.

---

## Criar o primeiro Monthly Report

### Via interface (recomendado)

1. Faça login no CRM com a conta `owner`
2. Navegue para **Relatório** no menu lateral
3. Clique em **"Fechar mês de YYYY-MM"**
4. Aguarde ~10s (gera snapshots + narrativa com Claude)
5. O relatório abre automaticamente para revisão

### Via API direta

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/close-month' \
  -H 'Authorization: Bearer <user-jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{"period": "2024-05"}'
```

O relatório ficará disponível em `/r/plp-2024-05` (rota pública, sem login).

---

## Estrutura do projeto

```
crm-plp/
├── apps/web/          # React SPA
│   └── src/
│       ├── components/    # UI reutilizável
│       ├── hooks/         # TanStack Query hooks
│       ├── lib/           # supabase client, auth, utils, seed
│       └── pages/         # Uma pasta por rota
├── supabase/
│   ├── migrations/    # SQL versionado
│   └── functions/     # Edge Functions (Deno)
└── packages/shared/   # Tipos Zod compartilhados
```

---

## Variáveis de ambiente

| Variável | Onde usar | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Chave pública anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed + Edge Functions | Chave service role (não expor no frontend) |
| `ANTHROPIC_API_KEY` | Edge Functions | Chave da API Anthropic |

---

## Comandos úteis

```bash
pnpm dev                    # Sobe o frontend em dev
pnpm build                  # Build de produção
pnpm seed                   # Popula banco com dados de teste
supabase start              # Sobe stack local completa
supabase db reset           # Reseta banco e reaplica migrations
supabase db push            # Aplica migrations pendentes
supabase functions serve    # Serve edge functions localmente
```
