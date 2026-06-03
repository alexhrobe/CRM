# Deploy (Vercel)

Frontend SPA (Vite) hospedado na Vercel. O repo já está pronto: `vercel.json`
(SPA rewrites), Node pinado em **≥22** (`.nvmrc` + `engines`, necessário para o
pnpm 11.5) e build verde no CI.

## Opção A — Modo demo (recomendado para testar primeiro) ⚡

Sobe em ~2 min, **sem backend e sem risco** — dados fictícios realistas, app
100% navegável (pipeline, solicitações, importar proposta, "Hoje").

1. https://vercel.com → **Add New → Project → Import** `alexhrobe/CRM`.
2. **Root Directory:** `apps/web`  ·  **Framework:** Vite (autodetecta).
3. **Environment Variables:** _nenhuma_ — sem credenciais, o app entra em modo
   demo automaticamente. (Opcional: `VITE_DEMO=1` para forçar.)
4. **Deploy.** Pronto: URL pública tipo `https://crm-xxx.vercel.app`.

## Opção B — Conectado ao Supabase real

Para testar com dados reais. **Antes** do deploy, aplique as migrations novas
ao seu projeto Supabase (senão as telas novas quebram):

```bash
supabase link --project-ref <seu-ref>
supabase db push          # aplica 0007 (RLS hardening) e 0008 (quote_requests)
```

Depois, no Vercel (mesmos passos da Opção A) adicione as **Environment
Variables**:

| Var | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | chave anon |

> Não coloque `ANTHROPIC_API_KEY`/`SERVICE_ROLE_KEY` na Vercel do frontend —
> esses são segredos das Edge Functions (Supabase), nunca do cliente.

## Configurações do projeto (Vercel)

| Campo | Valor |
|---|---|
| Root Directory | `apps/web` |
| Build Command | (padrão) `pnpm build` |
| Output Directory | `dist` |
| Install Command | (padrão, pnpm workspace) |
| Node.js Version | 22.x (lido de `.nvmrc`/`engines`) |

## Deploy via CLI (alternativa)

```bash
npm i -g vercel
vercel login
vercel --prod        # na raiz do repo; selecione apps/web como root
```
