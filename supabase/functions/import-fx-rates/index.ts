import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Currencies to track against BRL
const CURRENCIES = ['USD', 'EUR', 'ARS', 'CLP', 'COP', 'PEN', 'PYG']

/**
 * Fetches FX rates from Banco Central do Brasil (BCB) open API.
 * Endpoint: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/
 *   CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)
 *
 * BCB currency codes differ from ISO:
 *   USD=USD, EUR=EUR, ARS=ARS, CLP=CLP, COP=COP, PEN=PEN, PYG=PYG
 */

const BCB_CURRENCY_MAP: Record<string, string> = {
  USD: 'USD', EUR: 'EUR', ARS: 'ARS', CLP: 'CLP',
  COP: 'COP', PEN: 'PEN', PYG: 'PYG',
}

async function fetchBCBRate(currency: string, dateStr: string): Promise<number | null> {
  const bcbCode = BCB_CURRENCY_MAP[currency]
  if (!bcbCode) return null

  // BCB date format: MM-DD-YYYY
  const [y, m, d] = dateStr.split('-')
  const bcbDate = `${m}-${d}-${y}`

  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${bcbCode}'&@dataCotacao='${bcbDate}'&$top=1&$format=json&$select=cotacaoVenda`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = await res.json()
    const rate = json?.value?.[0]?.cotacaoVenda
    return rate ? parseFloat(rate.toFixed(4)) : null
  } catch {
    return null
  }
}

// Fallback rates when BCB API is unavailable
const FALLBACK_RATES: Record<string, number> = {
  USD: 5.05, EUR: 5.52, ARS: 0.0056, CLP: 0.0056,
  COP: 0.00125, PEN: 1.35, PYG: 0.00069,
}

Deno.serve(async (_req) => {
  const today = new Date().toISOString().slice(0, 10)
  const results: Array<{ currency: string; rate: number; source: string }> = []
  const errors: string[] = []

  for (const currency of CURRENCIES) {
    try {
      let rate = await fetchBCBRate(currency, today)
      let source = 'bcb'

      if (!rate) {
        // Try yesterday (weekend / holiday fallback)
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        rate = await fetchBCBRate(currency, yesterday)
        source = 'bcb_yesterday'
      }

      if (!rate) {
        // Ultimate fallback
        rate = FALLBACK_RATES[currency]
        source = 'fallback'
      }

      const { error } = await supabase.from('fx_rates').upsert(
        { date: today, currency, rate_to_brl: rate },
        { onConflict: 'date,currency' },
      )

      if (error) {
        errors.push(`${currency}: ${error.message}`)
      } else {
        results.push({ currency, rate, source })
      }
    } catch (err) {
      errors.push(`${currency}: ${(err as Error).message}`)
    }
  }

  return new Response(
    JSON.stringify({ ok: true, date: today, rates: results, errors }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
