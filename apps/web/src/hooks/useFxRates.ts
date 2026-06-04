import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Últimas taxas de câmbio por moeda (rate_to_brl). */
export function useFxRates() {
  const { data = [] } = useQuery({
    queryKey: ['fx-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fx_rates')
        .select('currency, rate_to_brl, date')
        .order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 30,
  })

  const rates: Record<string, number> = {}
  for (const r of data as Array<{ currency: string; rate_to_brl: number }>) {
    if (!(r.currency in rates)) rates[r.currency] = r.rate_to_brl // ordenado desc → 1º = mais recente
  }
  rates.BRL ??= 1

  function rateFor(currency: string | null | undefined): number | undefined {
    return currency ? rates[currency] : undefined
  }
  /** Converte um valor para BRL usando o FX próprio do registro ou a taxa vigente. */
  function toBRL(value: number | null | undefined, currency: string | null | undefined, ownFx?: number | null): number | null {
    if (value == null) return null
    const fx = ownFx ?? rateFor(currency)
    return fx != null ? value * fx : null
  }
  return { rates, rateFor, toBRL }
}
