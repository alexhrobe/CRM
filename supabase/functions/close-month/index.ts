import { serviceClient as supabase, getAuthedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { buildFxCache, valueToBrl } from '../_shared/fx.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getAuthedUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)
  if (user.role !== 'owner') return jsonResponse({ error: 'Forbidden: requires owner role' }, 403)

  const { period } = await req.json()

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return jsonResponse({ error: 'period must be YYYY-MM' }, 400)
  }

  const [year, month] = period.split('-')
  const periodStart = `${period}-01`
  const periodEnd = `${period}-${String(new Date(+year, +month, 0).getDate()).padStart(2, '0')}`
  const fxAsOf = periodEnd

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

  const allCurrencies = [
    ...(quotes ?? []).map((q) => q.currency),
    ...(orders ?? []).map((o) => o.currency),
  ]
  const fxCache = await buildFxCache(supabase, allCurrencies, fxAsOf)

  const brl = (total: number | null | undefined, currency: string | null | undefined, ownFx: number | null | undefined) =>
    valueToBrl(total, currency, ownFx, fxCache, fxAsOf)

  const totalQuotedBRL = (quotes ?? []).reduce((s, q) => s + brl(q.total_value, q.currency, q.fx_to_brl), 0)
  const totalOrdersBRL = (orders ?? []).reduce((s, o) => s + brl(o.total_value, o.currency, o.fx_to_brl), 0)

  const kpis = {
    quotes_received: quotes?.length ?? 0,
    quotes_sent: sentQuotes?.length ?? 0,
    orders_received: orders?.length ?? 0,
    total_quoted_brl: Math.round(totalQuotedBRL),
    total_orders_brl: Math.round(totalOrdersBRL),
  }

  const byCountryMap: Record<string, {
    country: string
    quoted: number
    orders: number
    won: number
    total: number
    hit_rate?: number
  }> = {}

  for (const q of quotes ?? []) {
    const iso2 = (q.account as { country_iso2?: string })?.country_iso2 ?? 'XX'
    if (!byCountryMap[iso2]) {
      byCountryMap[iso2] = {
        country: (q.account as { country?: string })?.country ?? iso2,
        quoted: 0, orders: 0, won: 0, total: 0,
      }
    }
    byCountryMap[iso2].quoted += brl(q.total_value, q.currency, q.fx_to_brl)
    byCountryMap[iso2].total++
    if (q.stage === 'won') byCountryMap[iso2].won++
  }

  for (const o of orders ?? []) {
    const iso2 = (o.account as { country_iso2?: string })?.country_iso2 ?? 'XX'
    if (!byCountryMap[iso2]) {
      byCountryMap[iso2] = {
        country: (o.account as { country?: string })?.country ?? iso2,
        quoted: 0, orders: 0, won: 0, total: 0,
      }
    }
    byCountryMap[iso2].orders += brl(o.total_value, o.currency, o.fx_to_brl)
  }

  for (const entry of Object.values(byCountryMap)) {
    entry.hit_rate = entry.total > 0 ? entry.won / entry.total : 0
    entry.quoted = Math.round(entry.quoted)
    entry.orders = Math.round(entry.orders)
  }

  const sortByBrl = (a: { total_value: number | null; currency: string; fx_to_brl: number | null }, b: typeof a) =>
    brl(b.total_value, b.currency, b.fx_to_brl) - brl(a.total_value, a.currency, a.fx_to_brl)

  const wonQuotes = (quotes ?? []).filter((q) => q.stage === 'won')
    .sort(sortByBrl)
    .slice(0, 10)
    .map((q) => ({
      account_name: (q.account as { legal_name?: string })?.legal_name,
      total_value: q.total_value,
      currency: q.currency,
      product_group: q.product_group,
    }))

  const lostQuotes = (quotes ?? []).filter((q) => q.stage === 'lost')
    .sort(sortByBrl)
    .slice(0, 10)
    .map((q) => ({
      account_name: (q.account as { legal_name?: string })?.legal_name,
      total_value: q.total_value,
      currency: q.currency,
      product_group: q.product_group,
    }))

  const commissionDS = wonQuotes.reduce((s, q) => s + (q.total_value ?? 0), 0) * 0.025
  const commissionDFJ = wonQuotes.reduce((s, q) => s + (q.total_value ?? 0), 0) * 0.015

  const timeSeries: Array<{
    month: string
    quotes_received: number | null
    quotes_sent: number | null
    orders_received: number | null
  }> = []

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

  const slug = `export-${period}`
  const productName = 'CRM Export'
  const title = `Relatório Executivo ${productName} — ${new Date(+year, +month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`

  const { data: report, error: rErr } = await supabase
    .from('monthly_reports')
    .upsert({ period, slug, title, created_by: user.id }, { onConflict: 'slug' })
    .select()
    .single()

  if (rErr) return jsonResponse({ error: rErr.message }, 500)

  const snapshots = [
    { report_id: report.id, metric_key: 'kpis', payload: kpis },
    { report_id: report.id, metric_key: 'by_country', payload: byCountryMap },
    { report_id: report.id, metric_key: 'top_quotes_won', payload: wonQuotes },
    { report_id: report.id, metric_key: 'top_quotes_lost', payload: lostQuotes },
    { report_id: report.id, metric_key: 'commission_estimate', payload: { ds_usd: commissionDS, dfj_usd: commissionDFJ } },
    { report_id: report.id, metric_key: 'time_series', payload: timeSeries },
  ]

  await supabase.from('report_snapshots').upsert(snapshots, { onConflict: 'report_id,metric_key' })

  const prevMonthData = timeSeries[timeSeries.length - 2]
  const prevOrdersCount = prevMonthData?.orders_received ?? 0
  const prevQuotesCount = prevMonthData?.quotes_received ?? 0

  const ordersDiff = kpis.orders_received - prevOrdersCount
  const ordersCompareText = ordersDiff > 0
    ? `um aumento de ${ordersDiff} pedido(s) em relação ao mês anterior (${prevOrdersCount} pedidos)`
    : ordersDiff < 0
      ? `uma redução de ${Math.abs(ordersDiff)} pedido(s) em relação ao mês anterior (${prevOrdersCount} pedidos)`
      : `o mesmo volume do mês anterior (${prevOrdersCount} pedidos)`

  const quotesDiff = kpis.quotes_received - prevQuotesCount
  const quotesCompareText = quotesDiff > 0
    ? `crescimento na captação com mais ${quotesDiff} cotação(ões) recebida(s)`
    : quotesDiff < 0
      ? `retração de ${Math.abs(quotesDiff)} cotação(ões) na captação`
      : `estabilidade na captação`

  const topWonText = wonQuotes.length > 0
    ? `Os principais negócios fechados foram liderados por: ${wonQuotes.slice(0, 3).map((q) => `${q.account_name} (${q.currency} ${q.total_value?.toLocaleString()})`).join(', ')}.`
    : 'Não houve registro de cotações ganhas relevantes neste período.'

  const countriesText = Object.entries(byCountryMap)
    .sort((a, b) => b[1].orders - a[1].orders)
    .slice(0, 3)
    .map(([, c]) => `${c.country} (R$ ${c.orders.toLocaleString()} em pedidos, hit rate de ${((c.hit_rate ?? 0) * 100).toFixed(0)}%)`)
    .join(', ')

  const countryHighlight = countriesText
    ? `Geograficamente, os mercados que mais se destacaram em volume de pedidos foram: ${countriesText}.`
    : 'Não houve faturamento ou pedidos fechados por região neste mês.'

  const narrative = `Relatório comercial do ${productName} referente ao período de ${period}. Durante este mês, registramos um volume total de cotações recebidas de R$ ${kpis.total_quoted_brl.toLocaleString()} (totalizando ${kpis.quotes_received} cotações), apresentando ${quotesCompareText} comparado ao mês anterior. O fechamento de negócios resultou em R$ ${kpis.total_orders_brl.toLocaleString()} em pedidos recebidos (${kpis.orders_received} pedidos), o que representa ${ordersCompareText}.

${topWonText} ${countryHighlight}

As comissões estimadas para o período são de USD ${commissionDS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para DS (2,5%) e USD ${commissionDFJ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para DFJ (1,5%).

Como prioridades comerciais para o próximo ciclo, recomenda-se:
1. Retomar contato urgente com cotações pendentes que estão no estágio de negociação para otimizar o hit rate geral.
2. Monitorar os mercados com queda de volume cotado na região.
3. Alinhar prazos de entrega com a produção para reduzir o atrito nos fechamentos.`

  await supabase.from('monthly_reports').update({ narrative }).eq('id', report.id)

  return jsonResponse({ ok: true, slug, report_id: report.id })
})
