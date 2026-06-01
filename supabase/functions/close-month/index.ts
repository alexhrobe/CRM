import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

Deno.serve(async (req) => {
  const { period } = await req.json() // e.g. '2024-05'

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return new Response(JSON.stringify({ error: 'period must be YYYY-MM' }), { status: 400 })
  }

  // Get calling user
  const authHeader = req.headers.get('Authorization')
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const [year, month] = period.split('-')
  const periodStart = `${period}-01`
  const periodEnd = `${period}-${new Date(+year, +month, 0).getDate()}`

  // ─── KPIs ─────────────────────────────────────────────────────────────────

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, stage, total_value, currency, fx_to_brl, quote_type, sent_at, decided_at, account:accounts(legal_name, country, country_iso2), product_group, commission_pct_ds, commission_pct_dfj')
    .gte('received_at', `${periodStart}T00:00:00Z`)
    .lte('received_at', `${periodEnd}T23:59:59Z`)

  const { data: sentQuotes } = await supabase
    .from('quotes')
    .select('id')
    .gte('sent_at', `${periodStart}T00:00:00Z`)
    .lte('sent_at', `${periodEnd}T23:59:59Z`)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_value, currency, fx_to_brl, account:accounts(legal_name, country, country_iso2)')
    .gte('received_at', `${periodStart}T00:00:00Z`)
    .lte('received_at', `${periodEnd}T23:59:59Z`)

  const totalQuotedBRL = (quotes ?? []).reduce((s, q) =>
    s + (q.total_value ?? 0) * (q.fx_to_brl ?? 5), 0)
  const totalOrdersBRL = (orders ?? []).reduce((s, o) =>
    s + (o.total_value ?? 0) * (o.fx_to_brl ?? 5), 0)

  const kpis = {
    quotes_received: quotes?.length ?? 0,
    quotes_sent: sentQuotes?.length ?? 0,
    orders_received: orders?.length ?? 0,
    total_quoted_brl: Math.round(totalQuotedBRL),
    total_orders_brl: Math.round(totalOrdersBRL),
  }

  // ─── By country ───────────────────────────────────────────────────────────

  const byCountryMap: Record<string, any> = {}
  for (const q of quotes ?? []) {
    const iso2 = (q.account as any)?.country_iso2 ?? 'XX'
    if (!byCountryMap[iso2]) byCountryMap[iso2] = {
      country: (q.account as any)?.country ?? iso2,
      quoted: 0, orders: 0, won: 0, total: 0,
    }
    byCountryMap[iso2].quoted += (q.total_value ?? 0) * (q.fx_to_brl ?? 5)
    byCountryMap[iso2].total++
    if (q.stage === 'won') byCountryMap[iso2].won++
  }
  for (const o of orders ?? []) {
    const iso2 = (o.account as any)?.country_iso2 ?? 'XX'
    if (!byCountryMap[iso2]) byCountryMap[iso2] = { country: (o.account as any)?.country, quoted: 0, orders: 0, won: 0, total: 0 }
    byCountryMap[iso2].orders += (o.total_value ?? 0) * (o.fx_to_brl ?? 5)
  }
  for (const entry of Object.values(byCountryMap)) {
    entry.hit_rate = entry.total > 0 ? entry.won / entry.total : 0
    entry.quoted = Math.round(entry.quoted)
    entry.orders = Math.round(entry.orders)
  }

  // ─── Top won / lost ───────────────────────────────────────────────────────

  const wonQuotes = (quotes ?? []).filter(q => q.stage === 'won')
    .sort((a, b) => ((b.total_value ?? 0) * (b.fx_to_brl ?? 5)) - ((a.total_value ?? 0) * (a.fx_to_brl ?? 5)))
    .slice(0, 10)
    .map(q => ({ account_name: (q.account as any)?.legal_name, total_value: q.total_value, currency: q.currency, product_group: q.product_group }))

  const lostQuotes = (quotes ?? []).filter(q => q.stage === 'lost')
    .sort((a, b) => ((b.total_value ?? 0) * (b.fx_to_brl ?? 5)) - ((a.total_value ?? 0) * (a.fx_to_brl ?? 5)))
    .slice(0, 10)
    .map(q => ({ account_name: (q.account as any)?.legal_name, total_value: q.total_value, currency: q.currency, product_group: q.product_group }))

  // ─── Commission estimate ──────────────────────────────────────────────────

  const commissionDS = wonQuotes.reduce((s, q) => s + ((q as any).total_value ?? 0), 0) * 0.025
  const commissionDFJ = wonQuotes.reduce((s, q) => s + ((q as any).total_value ?? 0), 0) * 0.015

  // ─── Time series (13 months) ──────────────────────────────────────────────

  const timeSeries: any[] = []
  for (let i = 12; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const m = d.toISOString().slice(0, 7)
    const mStart = `${m}-01T00:00:00Z`
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] + 'T23:59:59Z'

    const { count: mReceived } = await supabase.from('quotes').select('id', { count: 'exact', head: true })
      .gte('received_at', mStart).lte('received_at', mEnd)
    const { count: mSent } = await supabase.from('quotes').select('id', { count: 'exact', head: true })
      .gte('sent_at', mStart).lte('sent_at', mEnd)
    const { count: mOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true })
      .gte('received_at', mStart).lte('received_at', mEnd)

    timeSeries.push({ month: m, quotes_received: mReceived, quotes_sent: mSent, orders_received: mOrders })
  }

  // ─── Create report ────────────────────────────────────────────────────────

  const slug = `plp-${period}`
  const title = `Relatório Executivo PLP Export — ${new Date(+year, +month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`

  const { data: report, error: rErr } = await supabase
    .from('monthly_reports')
    .upsert({ period, slug, title, created_by: user.id }, { onConflict: 'slug' })
    .select()
    .single()

  if (rErr) return new Response(JSON.stringify({ error: rErr.message }), { status: 500 })

  // Save snapshots
  const snapshots = [
    { report_id: report.id, metric_key: 'kpis', payload: kpis },
    { report_id: report.id, metric_key: 'by_country', payload: byCountryMap },
    { report_id: report.id, metric_key: 'top_quotes_won', payload: wonQuotes },
    { report_id: report.id, metric_key: 'top_quotes_lost', payload: lostQuotes },
    { report_id: report.id, metric_key: 'commission_estimate', payload: { ds_usd: commissionDS, dfj_usd: commissionDFJ } },
    { report_id: report.id, metric_key: 'time_series', payload: timeSeries },
  ]

  await supabase.from('report_snapshots').upsert(snapshots, { onConflict: 'report_id,metric_key' })

  // ─── Generate narrative with Claude ───────────────────────────────────────

  const narrativePrompt = `Você é analista comercial sênior da PLP Brasil. Escreva uma narrativa executiva em PORTUGUÊS para o relatório mensal de exportações.

DADOS DO PERÍODO ${period}:

KPIs:
- Cotações recebidas: ${kpis.quotes_received}
- Cotações enviadas: ${kpis.quotes_sent}
- Pedidos recebidos: ${kpis.orders_received}
- Volume cotado total: R$ ${kpis.total_quoted_brl.toLocaleString()}
- Volume pedidos: R$ ${kpis.total_orders_brl.toLocaleString()}

DESEMPENHO POR PAÍS:
${Object.entries(byCountryMap).map(([iso2, d]: [string, any]) =>
  `  ${iso2} (${d.country}): cotado R$ ${d.quoted.toLocaleString()}, pedidos R$ ${d.orders.toLocaleString()}, hit rate ${(d.hit_rate * 100).toFixed(0)}%`
).join('\n')}

PRINCIPAIS PEDIDOS GANHOS:
${wonQuotes.slice(0, 5).map((q: any) => `  - ${q.account_name}: ${q.currency} ${q.total_value?.toLocaleString()} (${q.product_group})`).join('\n')}

SÉRIE HISTÓRICA (últimos 3 meses):
${timeSeries.slice(-3).map(m => `  ${m.month}: ${m.quotes_received} cotações, ${m.orders_received} pedidos`).join('\n')}

INSTRUÇÕES:
- Tom executivo, objetivo, sem adjetivos exagerados
- Highlight as variações mais relevantes vs meses anteriores
- Mencionar os mercados que se destacaram positiva e negativamente
- Sugerir 2-3 prioridades para o próximo mês
- Entre 300-400 palavras
- Organizar em parágrafos sem headers`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: narrativePrompt }],
  })

  const narrative = (msg.content[0] as any).text

  await supabase.from('monthly_reports').update({ narrative }).eq('id', report.id)

  return new Response(JSON.stringify({ ok: true, slug, report_id: report.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
