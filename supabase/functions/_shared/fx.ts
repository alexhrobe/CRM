import type { SupabaseClient } from 'npm:@supabase/supabase-js'

/** Cache de taxas por moeda+data (rate_to_brl). */
export type FxCache = Map<string, number>

function cacheKey(currency: string, asOf: string) {
  return `${currency}:${asOf}`
}

/** Carrega get_fx_rate do Postgres para cada moeda única (com cache). */
export async function buildFxCache(
  supabase: SupabaseClient,
  currencies: string[],
  asOf: string,
): Promise<FxCache> {
  const cache: FxCache = new Map()
  const unique = [...new Set(currencies.filter(Boolean))]
  await Promise.all(
    unique.map(async (currency) => {
      const { data, error } = await supabase.rpc('get_fx_rate', {
        p_currency: currency,
        p_date: asOf,
      })
      if (!error && data != null) {
        cache.set(cacheKey(currency, asOf), Number(data))
      }
    }),
  )
  return cache
}

/**
 * Valor em BRL — mesma regra que quote_value_brl() no Postgres:
 * usa fx travado do registro; senão taxa vigente na data (cache).
 */
export function valueToBrl(
  total: number | null | undefined,
  currency: string | null | undefined,
  ownFx: number | null | undefined,
  cache: FxCache,
  asOf: string,
  fallback = 5.05,
): number {
  if (total == null || !currency) return 0
  const fx = ownFx ?? cache.get(cacheKey(currency, asOf)) ?? cache.get(cacheKey('USD', asOf)) ?? fallback
  return total * fx
}
