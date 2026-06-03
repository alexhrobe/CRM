/**
 * Dados-semente do modo demo (sem backend). Realistas para a operação de
 * exportação da PLP Brasil. Datas e meses são gerados relativos a hoje para
 * que filtros por mês/atividade façam sentido em qualquer data.
 */

const DAY = 86_400_000
const now = Date.now()
const ago = (days: number) => new Date(now - days * DAY).toISOString()
const monthKey = (d: Date) => d.toISOString().slice(0, 7)

const today = new Date()
const months = Array.from({ length: 12 }, (_, i) =>
  monthKey(new Date(today.getFullYear(), today.getMonth() - (11 - i), 1)),
)

// ─── Contas ───────────────────────────────────────────────────────────────────

export const accounts = [
  { id: 'acc-ypf', legal_name: 'YPF Energía Eléctrica', country: 'Argentina', country_iso2: 'AR', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmissão', parent_account_id: null, notes: null, created_at: ago(400), updated_at: ago(5) },
  { id: 'acc-isa', legal_name: 'ISA Intercolombia', country: 'Colômbia', country_iso2: 'CO', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmissão', parent_account_id: null, notes: null, created_at: ago(380), updated_at: ago(2) },
  { id: 'acc-cge', legal_name: 'CGE Distribución', country: 'Chile', country_iso2: 'CL', account_type: 'distributor', currency_default: 'USD', segment: 'Distribuição', parent_account_id: null, notes: null, created_at: ago(360), updated_at: ago(9) },
  { id: 'acc-ande', legal_name: 'ANDE Paraguay', country: 'Paraguai', country_iso2: 'PY', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmissão', parent_account_id: null, notes: null, created_at: ago(340), updated_at: ago(14) },
  { id: 'acc-ute', legal_name: 'UTE Uruguay', country: 'Uruguai', country_iso2: 'UY', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmissão', parent_account_id: null, notes: null, created_at: ago(320), updated_at: ago(20) },
  { id: 'acc-cfe', legal_name: 'CFE México', country: 'México', country_iso2: 'MX', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmissão', parent_account_id: null, notes: null, created_at: ago(300), updated_at: ago(3) },
  { id: 'acc-statkraft', legal_name: 'Statkraft Perú', country: 'Peru', country_iso2: 'PE', account_type: 'direct_customer', currency_default: 'USD', segment: 'Geração', parent_account_id: null, notes: null, created_at: ago(280), updated_at: ago(7) },
  { id: 'acc-transener', legal_name: 'Transener', country: 'Argentina', country_iso2: 'AR', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmissão', parent_account_id: null, notes: null, created_at: ago(260), updated_at: ago(11) },
  { id: 'acc-enel-cl', legal_name: 'Enel Distribución Chile', country: 'Chile', country_iso2: 'CL', account_type: 'distributor', currency_default: 'USD', segment: 'Distribuição', parent_account_id: null, notes: null, created_at: ago(240), updated_at: ago(28) },
  { id: 'acc-celsia', legal_name: 'Celsia Colombia', country: 'Colômbia', country_iso2: 'CO', account_type: 'representative', currency_default: 'USD', segment: 'Distribuição', parent_account_id: null, notes: null, created_at: ago(220), updated_at: ago(33) },
]

const accName = (id: string) => accounts.find((a) => a.id === id)!

// ─── Pipeline ativo (view v_pipeline_active) ───────────────────────────────────

type PQ = {
  account_id: string; quote_number: string; quote_type: 'competitive' | 'reposition'
  stage: string; total_value: number; currency: string; fx_to_brl: number
  product_group: string | null; product_description: string | null
  received_at: string; last_activity_at: string; days_in_stage: number
  probability: number | null; alert?: { severity: 'info' | 'warning' | 'critical'; title: string }
}

const pipeline: PQ[] = [
  { account_id: 'acc-isa', quote_number: 'PLP-2024-0312', quote_type: 'competitive', stage: 'negotiation', total_value: 1_280_000, currency: 'USD', fx_to_brl: 5.12, product_group: 'opgw_fibra', product_description: 'OPGW 48F + ferragens 230kV', received_at: ago(34), last_activity_at: ago(11), days_in_stage: 12, probability: 65, alert: { severity: 'critical', title: 'Alto valor parado há 11 dias sem resposta' } },
  { account_id: 'acc-ypf', quote_number: 'PLP-2024-0331', quote_type: 'competitive', stage: 'received', total_value: 845_000, currency: 'USD', fx_to_brl: 5.08, product_group: 'preformados', product_description: 'Preformados e amortecedores LT 500kV', received_at: ago(3), last_activity_at: ago(3), days_in_stage: 3, probability: null, alert: { severity: 'warning', title: 'Recebida há 3 dias, ainda sem análise' } },
  { account_id: 'acc-cfe', quote_number: 'PLP-2024-0327', quote_type: 'reposition', stage: 'sent', total_value: 412_500, currency: 'USD', fx_to_brl: 5.05, product_group: 'cadeias', product_description: 'Cadeias de isoladores poliméricos 115kV', received_at: ago(18), last_activity_at: ago(6), days_in_stage: 6, probability: 50 },
  { account_id: 'acc-statkraft', quote_number: 'PLP-2024-0335', quote_type: 'competitive', stage: 'in_analysis', total_value: 298_000, currency: 'USD', fx_to_brl: 5.1, product_group: 'svd_amortecedor', product_description: 'Espaçadores-amortecedores feixe duplo', received_at: ago(5), last_activity_at: ago(1), days_in_stage: 2, probability: 40 },
  { account_id: 'acc-cge', quote_number: 'PLP-2024-0309', quote_type: 'competitive', stage: 'negotiation', total_value: 760_000, currency: 'USD', fx_to_brl: 5.15, product_group: 'ferragens', product_description: 'Ferragens e conectores 220kV', received_at: ago(40), last_activity_at: ago(4), days_in_stage: 9, probability: 70 },
  { account_id: 'acc-ande', quote_number: 'PLP-2024-0322', quote_type: 'reposition', stage: 'sent', total_value: 156_000, currency: 'USD', fx_to_brl: 5.07, product_group: 'isoladores', product_description: 'Isoladores poliméricos de suspensão', received_at: ago(22), last_activity_at: ago(8), days_in_stage: 8, probability: 45 },
  { account_id: 'acc-transener', quote_number: 'PLP-2024-0301', quote_type: 'competitive', stage: 'stalled', total_value: 540_000, currency: 'USD', fx_to_brl: 5.2, product_group: 'preformados', product_description: 'Preformados de emenda 500kV', received_at: ago(70), last_activity_at: ago(31), days_in_stage: 31, probability: 20, alert: { severity: 'warning', title: 'Esfriou: 31 dias sem atividade' } },
  { account_id: 'acc-ute', quote_number: 'PLP-2024-0318', quote_type: 'competitive', stage: 'received', total_value: 224_000, currency: 'USD', fx_to_brl: 5.06, product_group: 'cruzeta', product_description: 'Cruzetas poliméricas 34,5kV', received_at: ago(2), last_activity_at: ago(2), days_in_stage: 2, probability: null },
  { account_id: 'acc-enel-cl', quote_number: 'PLP-2024-0288', quote_type: 'reposition', stage: 'sent', total_value: 92_000, currency: 'USD', fx_to_brl: 5.09, product_group: 'conectores', product_description: 'Conectores de compressão AL', received_at: ago(25), last_activity_at: ago(10), days_in_stage: 10, probability: 35 },
  { account_id: 'acc-celsia', quote_number: 'PLP-2024-0341', quote_type: 'competitive', stage: 'in_analysis', total_value: 367_000, currency: 'USD', fx_to_brl: 5.11, product_group: 'opgw_fibra', product_description: 'OPGW 24F travessia de rio', received_at: ago(6), last_activity_at: ago(2), days_in_stage: 3, probability: 55 },
  { account_id: 'acc-isa', quote_number: 'PLP-2024-0295', quote_type: 'competitive', stage: 'negotiation', total_value: 980_000, currency: 'USD', fx_to_brl: 5.13, product_group: 'cadeias', product_description: 'Cadeias 500kV + ferragens', received_at: ago(48), last_activity_at: ago(15), days_in_stage: 15, probability: 60, alert: { severity: 'critical', title: 'Negociação >14 dias: risco de esfriar' } },
  { account_id: 'acc-ypf', quote_number: 'PLP-2024-0337', quote_type: 'reposition', stage: 'received', total_value: 178_500, currency: 'USD', fx_to_brl: 5.04, product_group: 'ferragens', product_description: 'Ferragens de ancoragem', received_at: ago(1), last_activity_at: ago(1), days_in_stage: 1, probability: null },
  { account_id: 'acc-cge', quote_number: 'PLP-2024-0276', quote_type: 'competitive', stage: 'stalled', total_value: 320_000, currency: 'USD', fx_to_brl: 5.18, product_group: 'svd_amortecedor', product_description: 'Amortecedores Stockbridge', received_at: ago(90), last_activity_at: ago(38), days_in_stage: 38, probability: 15 },
  { account_id: 'acc-statkraft', quote_number: 'PLP-2024-0339', quote_type: 'competitive', stage: 'sent', total_value: 615_000, currency: 'USD', fx_to_brl: 5.1, product_group: 'preformados', product_description: 'Preformados + SVD linha 220kV', received_at: ago(14), last_activity_at: ago(5), days_in_stage: 5, probability: 50 },
]

export const pipelineQuotes = pipeline.map((p, i) => {
  const a = accName(p.account_id)
  return {
    id: `q-${1000 + i}`,
    account_id: p.account_id,
    owner_id: 'demo-owner',
    assistant_id: null,
    quote_number: p.quote_number,
    quote_type: p.quote_type,
    stage: p.stage,
    total_value: p.total_value,
    currency: p.currency,
    fx_to_brl: p.fx_to_brl,
    probability: p.probability,
    product_group: p.product_group,
    product_description: p.product_description,
    received_at: p.received_at,
    sent_at: ['sent', 'negotiation', 'stalled'].includes(p.stage) ? ago(p.days_in_stage + 1) : null,
    expected_close_at: p.quote_number === 'PLP-2024-0331' ? ago(-3) : null, // validade em 3 dias (demo)
    decided_at: null,
    loss_reason: null, loss_competitor: null, loss_notes: null,
    commission_pct_ds: 0.02, commission_pct_dfj: 0.01, commission_pct_other: 0,
    commission_other_label: null,
    last_activity_at: p.last_activity_at,
    created_at: p.received_at,
    updated_at: p.last_activity_at,
    // campos da view
    account_name: a.legal_name,
    country: a.country,
    country_iso2: a.country_iso2,
    days_in_stage: p.days_in_stage,
    total_value_brl: Math.round(p.total_value * p.fx_to_brl),
    has_active_alert: Boolean(p.alert),
    alert_severity: p.alert?.severity ?? null,
    alert_title: p.alert?.title ?? null,
  }
})

// ─── Brain alerts ──────────────────────────────────────────────────────────────

export const brainAlerts = pipeline
  .filter((p) => p.alert)
  .map((p, i) => {
    const a = accName(p.account_id)
    return {
      id: `al-${i}`,
      account_id: p.account_id,
      quote_id: `q-${1000 + pipeline.indexOf(p)}`,
      alert_type: p.alert!.severity === 'critical' ? 'stalled_high_value' : 'cooling_quote',
      severity: p.alert!.severity,
      title: p.alert!.title,
      body: `${a.legal_name} — ${p.product_description}. Valor ${p.currency} ${p.total_value.toLocaleString('en-US')}.`,
      suggested_action: 'Enviar follow-up ao contato comercial',
      suggested_prompt: `Escreva um follow-up cordial em espanhol para ${a.legal_name} sobre a cotação ${p.quote_number}.`,
      dismissed: false,
      dismissed_at: null,
      expires_at: null,
      created_at: ago(i),
      updated_at: ago(i),
      account: { legal_name: a.legal_name },
      quote: { quote_number: p.quote_number, stage: p.stage },
    }
  })

// ─── Métricas por país (view v_country_metrics) ────────────────────────────────

export const countryMetrics = [
  { country: 'Argentina', country_iso2: 'AR', quoted_value_usd: 2_390_000, orders_value_usd: 1_120_000, hit_rate: 0.42, quote_count: 9, order_count: 4 },
  { country: 'Colômbia', country_iso2: 'CO', quoted_value_usd: 2_627_000, orders_value_usd: 1_540_000, hit_rate: 0.55, quote_count: 7, order_count: 5 },
  { country: 'Chile', country_iso2: 'CL', quoted_value_usd: 1_172_000, orders_value_usd: 480_000, hit_rate: 0.33, quote_count: 6, order_count: 2 },
  { country: 'México', country_iso2: 'MX', quoted_value_usd: 912_500, orders_value_usd: 612_000, hit_rate: 0.50, quote_count: 4, order_count: 2 },
  { country: 'Peru', country_iso2: 'PE', quoted_value_usd: 913_000, orders_value_usd: 300_000, hit_rate: 0.40, quote_count: 5, order_count: 2 },
  { country: 'Paraguai', country_iso2: 'PY', quoted_value_usd: 156_000, orders_value_usd: 0, hit_rate: 0.25, quote_count: 3, order_count: 0 },
  { country: 'Uruguai', country_iso2: 'UY', quoted_value_usd: 224_000, orders_value_usd: 98_000, hit_rate: 0.38, quote_count: 2, order_count: 1 },
]

// ─── KPIs mensais (view v_monthly_kpis) ────────────────────────────────────────

export const monthlyKpis = months.map((m, i) => {
  const grow = 1 + i * 0.06
  return {
    month: m,
    quotes_received: Math.round(8 + i * 0.8 + (i % 3)),
    quotes_sent: Math.round(6 + i * 0.7),
    orders_received: Math.round(2 + i * 0.35),
    total_quoted_usd: Math.round(1_400_000 * grow),
    total_ordered_usd: Math.round(520_000 * grow),
  }
})

// ─── Saúde das contas (view v_account_health) ──────────────────────────────────

export const accountHealth = accounts.map((a, i) => ({
  account_id: a.id,
  legal_name: a.legal_name,
  country: a.country,
  country_iso2: a.country_iso2,
  last_activity_at: ago(2 + i * 3),
  pipeline_value_usd: [1_280_000, 2_260_000, 1_080_000, 156_000, 224_000, 412_500, 913_000, 540_000, 92_000, 367_000][i] ?? 0,
  hit_rate: [0.42, 0.55, 0.33, 0.25, 0.38, 0.5, 0.4, 0.31, 0.29, 0.36][i] ?? 0,
  open_quotes: [2, 2, 2, 1, 1, 1, 2, 1, 1, 1][i] ?? 0,
  won_quotes: [4, 5, 2, 0, 1, 2, 2, 1, 1, 1][i] ?? 0,
  total_quotes: [9, 7, 6, 3, 2, 4, 5, 4, 3, 3][i] ?? 0,
}))

// ─── Usuário demo ───────────────────────────────────────────────────────────────

export const demoUser = {
  id: 'demo-owner',
  name: 'Demo PLP',
  role: 'owner',
  created_at: ago(400),
  updated_at: ago(1),
}

// Mapa tabela/view -> dataset
export const datasets: Record<string, any[]> = {
  users: [demoUser],
  accounts,
  v_account_health: accountHealth,
  v_pipeline_active: pipelineQuotes,
  v_country_metrics: countryMetrics,
  v_monthly_kpis: monthlyKpis,
  brain_alerts: brainAlerts,
  quotes: pipelineQuotes,
  contacts: [],
  activities: [],
  orders: [],
  order_items: [],
  quote_items: [],
  monthly_reports: [],
  report_snapshots: [],
  fx_rates: [],
}
