import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

async function generateAlertText(context: string): Promise<{
  title: string; body: string; suggested_action: string; suggested_prompt: string
}> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Você é o sistema de IA do CRM de exportação da PLP Brasil. Gere um alerta conciso em português baseado neste contexto:

${context}

Responda APENAS em JSON com os campos:
- title: string (máx 60 chars, objetivo)
- body: string (1 frase explicativa)
- suggested_action: string (ação curta para o usuário)
- suggested_prompt: string (comando completo para o usuário executar)`,
    }],
  })

  try {
    const text = (msg.content[0] as any).text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch {}

  return {
    title: 'Atenção necessária',
    body: context.slice(0, 100),
    suggested_action: 'Verificar item',
    suggested_prompt: 'Verificar e tomar ação necessária',
  }
}

async function deduplicateAlert(quoteId: string | null, alertType: string): Promise<boolean> {
  const q = supabase.from('brain_alerts')
    .select('id')
    .eq('alert_type', alertType)
    .eq('dismissed', false)
  if (quoteId) q.eq('quote_id', quoteId)
  const { data } = await q.limit(1)
  return (data?.length ?? 0) > 0
}

Deno.serve(async (_req) => {
  try {
    const now = new Date()
    const alertsCreated: string[] = []

    // 1. Cooling quotes (sent > 5 days)
    const { data: coolingQuotes } = await supabase
      .from('quotes')
      .select('id, account_id, quote_number, total_value, currency, last_activity_at, account:accounts(legal_name)')
      .eq('stage', 'sent')
      .lt('last_activity_at', new Date(now.getTime() - 5 * 86400000).toISOString())

    for (const q of coolingQuotes ?? []) {
      const exists = await deduplicateAlert(q.id, 'cooling_quote')
      if (exists) continue

      const daysSince = Math.floor((now.getTime() - new Date(q.last_activity_at).getTime()) / 86400000)
      const severity = q.total_value > 500000 && daysSince > 7 ? 'critical' : 'warning'
      const context = `Cotação ${q.quote_number} para ${(q.account as any)?.legal_name} está em estágio "enviada" há ${daysSince} dias sem atividade. Valor: ${q.currency} ${q.total_value?.toLocaleString()}.`

      const text = await generateAlertText(context)
      await supabase.from('brain_alerts').insert({
        quote_id: q.id,
        account_id: q.account_id,
        alert_type: 'cooling_quote',
        severity,
        ...text,
        expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
      })
      alertsCreated.push(`cooling_quote:${q.quote_number}`)
    }

    // 2. Negotiation at risk (> 10 days)
    const { data: riskyNeg } = await supabase
      .from('quotes')
      .select('id, account_id, quote_number, total_value, currency, last_activity_at, account:accounts(legal_name)')
      .eq('stage', 'negotiation')
      .lt('last_activity_at', new Date(now.getTime() - 10 * 86400000).toISOString())

    for (const q of riskyNeg ?? []) {
      const exists = await deduplicateAlert(q.id, 'stalled_high_value')
      if (exists) continue

      const daysSince = Math.floor((now.getTime() - new Date(q.last_activity_at).getTime()) / 86400000)
      const severity = daysSince > 14 ? 'critical' : 'warning'
      const context = `Negociação da cotação ${q.quote_number} com ${(q.account as any)?.legal_name} está parada há ${daysSince} dias. Valor: ${q.currency} ${q.total_value?.toLocaleString()}.`

      const text = await generateAlertText(context)
      await supabase.from('brain_alerts').insert({
        quote_id: q.id,
        account_id: q.account_id,
        alert_type: 'stalled_high_value',
        severity,
        ...text,
        expires_at: new Date(now.getTime() + 5 * 86400000).toISOString(),
      })
      alertsCreated.push(`stalled_high_value:${q.quote_number}`)
    }

    // 3. Pattern anomaly: country volume drop
    const threeMonthsAgo = new Date(now.getTime() - 90 * 86400000).toISOString()
    const { data: recentQuotes } = await supabase
      .from('quotes')
      .select('account:accounts(country_iso2, country), total_value, received_at')
      .gte('received_at', threeMonthsAgo)

    // Group by country and month
    const byCountryMonth: Record<string, number[]> = {}
    for (const q of recentQuotes ?? []) {
      const iso2 = (q.account as any)?.country_iso2
      if (!iso2) continue
      const month = q.received_at.slice(0, 7)
      const key = `${iso2}:${month}`
      byCountryMonth[key] = (byCountryMonth[key] ?? [])
      byCountryMonth[key].push(q.total_value ?? 0)
    }

    const countrySums: Record<string, number[]> = {}
    for (const [key, vals] of Object.entries(byCountryMonth)) {
      const [iso2] = key.split(':')
      if (!countrySums[iso2]) countrySums[iso2] = []
      countrySums[iso2].push(vals.reduce((a, b) => a + b, 0))
    }

    const currentMonth = now.toISOString().slice(0, 7)
    for (const [iso2, months] of Object.entries(countrySums)) {
      if (months.length < 3) continue
      const avg = months.slice(0, -1).reduce((a, b) => a + b, 0) / (months.length - 1)
      const current = months[months.length - 1]
      const drop = avg > 0 ? (avg - current) / avg : 0
      if (drop > 0.3) {
        const existing = await supabase.from('brain_alerts')
          .select('id').eq('alert_type', 'unusual_drop').eq('dismissed', false)
          .contains('body', iso2).limit(1)
        if ((existing.data?.length ?? 0) === 0) {
          const context = `Volume cotado para ${iso2} no mês atual é ${(drop * 100).toFixed(0)}% menor que a média dos últimos 3 meses (atual: USD ${current.toLocaleString()} vs média: USD ${avg.toLocaleString()}).`
          const text = await generateAlertText(context)
          await supabase.from('brain_alerts').insert({
            alert_type: 'unusual_drop',
            severity: 'info',
            ...text,
            expires_at: new Date(now.getTime() + 14 * 86400000).toISOString(),
          })
          alertsCreated.push(`unusual_drop:${iso2}`)
        }
      }
    }

    // Run auto-stall and auto-expire
    await supabase.rpc('auto_stall_quotes')
    await supabase.rpc('auto_expire_stalled')

    return new Response(
      JSON.stringify({ ok: true, alerts_created: alertsCreated.length, details: alertsCreated }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
