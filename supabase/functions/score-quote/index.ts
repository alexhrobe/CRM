import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const { quote_id } = await req.json()

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, account:accounts(country_iso2)')
    .eq('id', quote_id)
    .single()

  if (!quote) {
    return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 })
  }

  // Win rate by account
  const { data: acctHistory } = await supabase
    .from('quotes')
    .select('stage')
    .eq('account_id', quote.account_id)
    .in('stage', ['won', 'lost'])

  const acctWins = (acctHistory ?? []).filter(q => q.stage === 'won').length
  const acctTotal = (acctHistory ?? []).length
  const acctWinRate = acctTotal > 0 ? acctWins / acctTotal : 0.35

  // Win rate by country
  const countryIso2 = (quote.account as any)?.country_iso2
  let countryWinRate = 0.35
  if (countryIso2) {
    const { data: countryHistory } = await supabase
      .from('quotes')
      .select('stage, account:accounts!inner(country_iso2)')
      .eq('account.country_iso2', countryIso2)
      .in('stage', ['won', 'lost'])
    const cWins = (countryHistory ?? []).filter((q: any) => q.stage === 'won').length
    const cTotal = (countryHistory ?? []).length
    if (cTotal > 0) countryWinRate = cWins / cTotal
  }

  // Win rate by value band
  const value = quote.total_value ?? 0
  let valueBandRate = 0.40
  const valueBands = [
    { max: 50000, rate: 0.55 },
    { max: 150000, rate: 0.45 },
    { max: 400000, rate: 0.35 },
    { max: Infinity, rate: 0.25 },
  ]
  for (const band of valueBands) {
    if (value <= band.max) { valueBandRate = band.rate; break }
  }

  // Stage timing vs median
  const daysInStage = Math.floor(
    (Date.now() - new Date(quote.last_activity_at).getTime()) / 86400000
  )
  const STAGE_MEDIANS: Record<string, number> = {
    received: 3, in_analysis: 5, sent: 7, negotiation: 14,
  }
  const median = STAGE_MEDIANS[quote.stage] ?? 7
  const stagePenalty = Math.max(0, (daysInStage - median) / median) * 0.15

  // Type adjustment
  const typeBase = quote.quote_type === 'reposition' ? 0.65 : 0.35

  // Weighted score
  const rawScore = (
    acctWinRate * 0.30 +
    countryWinRate * 0.20 +
    valueBandRate * 0.20 +
    typeBase * 0.30
  ) - stagePenalty

  const probability = Math.max(5, Math.min(95, Math.round(rawScore * 100)))

  await supabase
    .from('quotes')
    .update({ probability })
    .eq('id', quote_id)

  return new Response(JSON.stringify({ probability }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
