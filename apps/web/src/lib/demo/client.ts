/**
 * Cliente Supabase falso para o MODO DEMO (sem backend).
 *
 * É COM ESTADO: insert/update/delete alteram os datasets em memória (in-place,
 * para preservar o alias entre `quotes` e `v_pipeline_active`), de modo que
 * mover cards, editar e excluir funcionem de verdade — sem backend.
 *
 * Cobre a superfície usada pelo app: auth (sessão sempre logada) e o
 * query-builder (`from().select().eq().order().single()` + insert/update/delete).
 */
import { datasets, demoUser } from './data'

const ok = <T>(data: T) => Promise.resolve({ data, error: null })
const nowISO = () => new Date().toISOString()
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`

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

type Row = Record<string, any>

/** Preenche campos esperados pelas views ao inserir (para o card renderizar). */
function enrich(table: string, input: Row): Row {
  const r: Row = { id: newId(), created_at: nowISO(), updated_at: nowISO(), ...input }
  if (table === 'quotes') {
    const acc = (datasets.accounts ?? []).find((a) => a.id === r.account_id)
    r.stage ??= 'received'
    r.currency ??= 'USD'
    r.account_name ??= acc?.legal_name ?? '—'
    r.country ??= acc?.country ?? ''
    r.country_iso2 ??= acc?.country_iso2 ?? null
    r.days_in_stage ??= 0
    r.total_value_brl ??=
      r.total_value != null && r.fx_to_brl != null ? Math.round(r.total_value * r.fx_to_brl) : null
    r.has_active_alert ??= false
    r.alert_severity ??= null
    r.alert_title ??= null
    r.last_activity_at ??= r.created_at
    r.received_at ??= r.created_at
  }
  return r
}

function makeQuery(table: string) {
  const filters: Array<[string, unknown]> = []
  let limitN: number | null = null
  const run = () => {
    let rows = [...(datasets[table] ?? [])]
    for (const [col, val] of filters) rows = rows.filter((r) => r[col] === undefined || r[col] === val)
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

function makeMutation(table: string, kind: 'insert' | 'update' | 'upsert' | 'delete', payload: unknown) {
  const filters: Array<[string, unknown]> = []
  let result: Row[] | null = null

  const exec = (): Row[] => {
    if (result) return result
    const arr: Row[] = (datasets[table] ??= [])
    const match = (r: Row) => filters.every(([c, v]) => r[c] === v)

    if (kind === 'insert' || kind === 'upsert') {
      const rows = (Array.isArray(payload) ? payload : payload ? [payload] : []).map((p) => enrich(table, p as Row))
      arr.push(...rows)
      result = rows
    } else if (kind === 'update') {
      const targets = filters.length ? arr.filter(match) : [...arr]
      targets.forEach((r) => Object.assign(r, payload as Row, { updated_at: nowISO() }))
      result = targets
    } else {
      // delete — splice in-place para manter o alias (quotes ≡ v_pipeline_active)
      const removed: Row[] = []
      for (let i = arr.length - 1; i >= 0; i--) {
        if (match(arr[i])) removed.push(...arr.splice(i, 1))
      }
      result = removed
    }
    return result
  }

  const api: Record<string, any> = {
    eq: (col: string, val: unknown) => { filters.push([col, val]); return api },
    neq: () => api, in: () => api, is: () => api, match: () => api,
    select: () => api,
    single: () => ok(exec()[0] ?? null),
    maybeSingle: () => ok(exec()[0] ?? null),
    then: (onF: any, onR: any) => ok(exec()).then(onF, onR),
  }
  return api
}

export function createDemoClient() {
  let authCb: ((event: string, session: typeof demoSession) => void) | null = null
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
      insert: (p: unknown) => makeMutation(table, 'insert', p),
      update: (p: unknown) => makeMutation(table, 'update', p),
      upsert: (p: unknown) => makeMutation(table, 'upsert', p),
      delete: () => makeMutation(table, 'delete', null),
    }),
  }
}
