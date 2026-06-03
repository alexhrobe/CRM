/**
 * Cliente Supabase falso para o MODO DEMO (sem backend).
 * Cobre a superfície usada pelo app: auth (sessão sempre logada) e o
 * query-builder (`from().select().eq().order().single()` + insert/update/delete).
 * Filtros são aplicados de forma best-effort; o objetivo é renderizar o app
 * com dados realistas, não emular o PostgREST.
 */
import { datasets, demoUser } from './data'

const ok = <T>(data: T) => Promise.resolve({ data, error: null })

const demoSession = {
  access_token: 'demo-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'demo-refresh',
  user: {
    id: demoUser.id,
    email: 'demo@plpbrasil.com',
    app_metadata: {},
    user_metadata: { name: demoUser.name, role: demoUser.role },
    aud: 'authenticated',
    created_at: demoUser.created_at,
  },
}

function makeQuery(table: string) {
  const filters: Array<[string, unknown]> = []
  let limitN: number | null = null

  const run = () => {
    let rows = [...(datasets[table] ?? [])]
    for (const [col, val] of filters) {
      rows = rows.filter((r) => r[col] === undefined || r[col] === val)
    }
    return limitN != null ? rows.slice(0, limitN) : rows
  }

  const api: Record<string, any> = {
    select: () => api,
    eq: (col: string, val: unknown) => { filters.push([col, val]); return api },
    neq: () => api, gt: () => api, gte: () => api, lt: () => api, lte: () => api,
    in: () => api, is: () => api, or: () => api, not: () => api,
    like: () => api, ilike: () => api, contains: () => api, filter: () => api,
    order: () => api, range: () => api,
    limit: (n: number) => { limitN = n; return api },
    single: () => ok(run()[0] ?? null),
    maybeSingle: () => ok(run()[0] ?? null),
    then: (onF: any, onR: any) => ok(run()).then(onF, onR),
  }
  return api
}

function makeMutation(payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : payload
      ? [{ id: crypto.randomUUID(), ...(payload as object) }]
      : []
  const api: Record<string, any> = {
    select: () => api,
    eq: () => api,
    single: () => ok(rows[0] ?? null),
    then: (onF: any, onR: any) => ok(rows).then(onF, onR),
  }
  return api
}

export function createDemoClient() {
  let authCb: ((event: string, session: typeof demoSession) => void) | null = null
  // entrega a sessão demo logo após a montagem
  setTimeout(() => authCb?.('SIGNED_IN', demoSession), 0)

  return {
    auth: {
      getSession: () => ok({ session: demoSession }),
      getUser: () => ok({ user: demoSession.user }),
      onAuthStateChange: (cb: (e: string, s: typeof demoSession) => void) => {
        authCb = cb
        return { data: { subscription: { unsubscribe: () => { authCb = null } } } }
      },
      signInWithPassword: () => ok({ session: demoSession, user: demoSession.user }),
      signOut: () => ok(null),
    },
    from: (table: string) => ({
      ...makeQuery(table),
      insert: (p: unknown) => makeMutation(p),
      update: (p: unknown) => makeMutation(p),
      upsert: (p: unknown) => makeMutation(p),
      delete: () => makeMutation(null),
    }),
  }
}
