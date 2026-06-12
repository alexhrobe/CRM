import { serviceClient as supabase, isAuthorizedCron, getAuthedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!isAuthorizedCron(req)) {
    const user = await getAuthedUser(req)
    if (!user || user.role !== 'owner') return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const today = new Date().toISOString().slice(0, 10)
  const results: Array<{ currency: string; rate: number; source: string }> = []
  const errors: string[] = []

  const { data: runRow } = await supabase
    .from('job_runs')
    .insert({ job_name: 'import_fx_rates' })
    .select('id')
    .single()
  const runId = runRow?.id

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

  const success = errors.length === 0
  const details = { date: today, rates: results, errors }

  if (runId) {
    await supabase.from('job_runs').update({
      finished_at: new Date().toISOString(),
      success,
      details,
      error_message: errors.length > 0 ? errors.join('; ') : null,
    }).eq('id', runId)
  }

  return jsonResponse({ ok: success, ...details })
})
