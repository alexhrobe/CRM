/**
 * Seed script for CRM PLP Export
 * Run: pnpm seed (requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Data definitions ─────────────────────────────────────────────────────────

const ACCOUNTS = [
  { legal_name: 'ELECNOR Argentina S.A.', country: 'Argentina', country_iso2: 'AR', account_type: 'direct_customer', currency_default: 'USD', segment: 'EPC' },
  { legal_name: 'YPF Energia Eléctrica', country: 'Argentina', country_iso2: 'AR', account_type: 'direct_customer', currency_default: 'USD', segment: 'Oil & Gas' },
  { legal_name: 'Isolux Corsán Argentina', country: 'Argentina', country_iso2: 'AR', account_type: 'distributor', currency_default: 'USD', segment: 'EPC' },
  { legal_name: 'EDESUR', country: 'Argentina', country_iso2: 'AR', account_type: 'direct_customer', currency_default: 'USD', segment: 'Utility' },
  { legal_name: 'Transnea S.A.', country: 'Argentina', country_iso2: 'AR', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmission' },
  { legal_name: 'CPPE Chile', country: 'Chile', country_iso2: 'CL', account_type: 'direct_customer', currency_default: 'USD', segment: 'Utility' },
  { legal_name: 'Transelec Chile', country: 'Chile', country_iso2: 'CL', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmission' },
  { legal_name: 'AES Gener', country: 'Chile', country_iso2: 'CL', account_type: 'direct_customer', currency_default: 'USD', segment: 'Generation' },
  { legal_name: 'SAESA Group', country: 'Chile', country_iso2: 'CL', account_type: 'distributor', currency_default: 'USD', segment: 'Distribution' },
  { legal_name: 'ISA TRANSCHILE', country: 'Chile', country_iso2: 'CL', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmission' },
  { legal_name: 'ISA Colombia', country: 'Colômbia', country_iso2: 'CO', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmission' },
  { legal_name: 'Ecopetrol S.A.', country: 'Colômbia', country_iso2: 'CO', account_type: 'direct_customer', currency_default: 'USD', segment: 'Oil & Gas' },
  { legal_name: 'Celsia Colombia', country: 'Colômbia', country_iso2: 'CO', account_type: 'direct_customer', currency_default: 'USD', segment: 'Utility' },
  { legal_name: 'OMEGA Peru', country: 'Peru', country_iso2: 'PE', account_type: 'direct_customer', currency_default: 'USD', segment: 'EPC' },
  { legal_name: 'REP Peru', country: 'Peru', country_iso2: 'PE', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmission' },
  { legal_name: 'ENOSA Peru', country: 'Peru', country_iso2: 'PE', account_type: 'direct_customer', currency_default: 'USD', segment: 'Distribution' },
  { legal_name: 'ANDE Paraguay', country: 'Paraguai', country_iso2: 'PY', account_type: 'direct_customer', currency_default: 'USD', segment: 'Utility' },
  { legal_name: 'Copaco S.A.', country: 'Paraguai', country_iso2: 'PY', account_type: 'direct_customer', currency_default: 'USD', segment: 'Telecom' },
  { legal_name: 'UTE Uruguay', country: 'Uruguai', country_iso2: 'UY', account_type: 'direct_customer', currency_default: 'USD', segment: 'Utility' },
  { legal_name: 'CFE Mexico', country: 'México', country_iso2: 'MX', account_type: 'direct_customer', currency_default: 'USD', segment: 'Utility' },
  { legal_name: 'IEnova Mexico', country: 'México', country_iso2: 'MX', account_type: 'direct_customer', currency_default: 'USD', segment: 'Midstream' },
  { legal_name: 'PLP Co. USA', country: 'EUA', country_iso2: 'US', account_type: 'subsidiary', currency_default: 'USD', segment: 'Hardware' },
  { legal_name: 'Preformed Line Products Iberia', country: 'Espanha', country_iso2: 'ES', account_type: 'subsidiary', currency_default: 'EUR', segment: 'Hardware' },
  { legal_name: 'Red Eléctrica de España', country: 'Espanha', country_iso2: 'ES', account_type: 'direct_customer', currency_default: 'EUR', segment: 'Transmission' },
  { legal_name: 'PGE Dystrybucja Poland', country: 'Polônia', country_iso2: 'PL', account_type: 'direct_customer', currency_default: 'EUR', segment: 'Distribution' },
  { legal_name: 'ENEA Operator Poland', country: 'Polônia', country_iso2: 'PL', account_type: 'direct_customer', currency_default: 'EUR', segment: 'Distribution' },
  { legal_name: 'PEA Thailand', country: 'Tailândia', country_iso2: 'TH', account_type: 'direct_customer', currency_default: 'USD', segment: 'Utility' },
  { legal_name: 'EGAT Thailand', country: 'Tailândia', country_iso2: 'TH', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmission' },
  { legal_name: 'ISA Bolivia', country: 'Bolívia', country_iso2: 'BO', account_type: 'direct_customer', currency_default: 'USD', segment: 'Transmission' },
  { legal_name: 'Distribuidora Electrica Ecuador', country: 'Equador', country_iso2: 'EC', account_type: 'representative', currency_default: 'USD', segment: 'Distribution' },
]

const PRODUCT_GROUPS = ['preformados','cadeias','svd_amortecedor','opgw_fibra','cruzeta','ferragens','isoladores','conectores','outros']
const PRODUCT_DESCRIPTIONS: Record<string, string[]> = {
  preformados: ['Preformados de tensão 138kV', 'Preformados de ancoragem 230kV', 'Kit preformado ACSR 795 MCM'],
  cadeias: ['Cadeia de isoladores vidro 230kV', 'Cadeia disco isolador 500kV', 'Cadeia ancoragem 138kV'],
  svd_amortecedor: ['SVD amortecedor spiralado 500kV', 'Amortecedor stockbridge ACSR', 'Kit amortecedor OPGW 24F'],
  opgw_fibra: ['OPGW 24 fibras 36mm²', 'OPGW 48 fibras 48mm²', 'Acessórios OPGW emenda'],
  cruzeta: ['Cruzeta perfil C aço galvanizado', 'Cruzeta double circuit 138kV', 'Cruzeta fibra composta 500kV'],
  ferragens: ['Ferragens ancoragem suspenção', 'Kit ferragens linha 230kV', 'Ferragens para cabo ACSR Grosbeak'],
  isoladores: ['Isoladores polimérico 138kV', 'Isoladores vidro 70kN', 'Isoladores pino classe 15kV'],
  conectores: ['Conector compressão ACSR 336', 'Conector bimetálico AL/CU', 'Luva emenda bolsa 795 MCM'],
  outros: ['Equipamentos de proteção', 'Ferramentas instalação', 'Material auxiliar'],
}

const STAGES_DIST = ['received','received','in_analysis','sent','sent','sent','negotiation','negotiation','won','won','won','lost','lost','stalled','expired']
const LOSS_REASONS = ['price','lead_time','competitor','specification','no_response','customer_canceled','other']

function random<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randomFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}
function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString()
}

async function seed() {
  console.log('🌱 Iniciando seed...')

  // ─── Create a seed user ──────────────────────────────────────────────────────
  console.log('👤 Criando usuário seed...')
  let seedUserId: string

  // Try to get existing seed user from public.users
  const { data: existingUsers } = await db.from('users').select('id').limit(1)
  if (existingUsers && existingUsers.length > 0) {
    seedUserId = existingUsers[0].id
    console.log('  → Usando usuário existente:', seedUserId)
  } else {
    // Create via auth
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: 'owner@plpbrasil.com',
      password: 'PLP@2024!',
      email_confirm: true,
      user_metadata: { name: 'Admin PLP', role: 'owner' },
    })
    if (authError) {
      console.error('Erro ao criar usuário:', authError.message)
      process.exit(1)
    }
    seedUserId = authData.user.id
    // Ensure profile exists
    await db.from('users').upsert({ id: seedUserId, name: 'Admin PLP', role: 'owner' })
    console.log('  → Usuário criado:', seedUserId)
  }

  // ─── FX rates ────────────────────────────────────────────────────────────────
  console.log('💱 Inserindo taxas FX...')
  const currencies = ['USD','EUR','ARS','CLP','COP','PEN','PYG']
  const fxRates: any[] = []
  for (let i = 0; i < 90; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    for (const currency of currencies) {
      const baseRates: Record<string, number> = {
        USD: 5.05, EUR: 5.52, ARS: 0.0056, CLP: 0.0056,
        COP: 0.00125, PEN: 1.35, PYG: 0.00069,
      }
      fxRates.push({
        date,
        currency,
        rate_to_brl: +(baseRates[currency] * (1 + (Math.random() - 0.5) * 0.04)).toFixed(4),
      })
    }
  }
  const { error: fxError } = await db.from('fx_rates').upsert(fxRates, { onConflict: 'date,currency' })
  if (fxError) console.warn('FX upsert warning:', fxError.message)

  // ─── Accounts ────────────────────────────────────────────────────────────────
  console.log('🏢 Criando contas...')
  const { data: accounts, error: accError } = await db
    .from('accounts')
    .upsert(ACCOUNTS.map(a => ({ ...a })), { onConflict: 'legal_name' })
    .select()
  if (accError) { console.error('Erro accounts:', accError.message); process.exit(1) }
  console.log(`  → ${accounts!.length} contas`)

  // ─── Contacts ────────────────────────────────────────────────────────────────
  console.log('👤 Criando contatos...')
  const CONTACTS_DATA = [
    { first: 'Carlos', last: 'Mendoza', role: 'Gerente de Compras' },
    { first: 'Laura', last: 'Gómez', role: 'Engenheira de Projetos' },
    { first: 'Roberto', last: 'Silva', role: 'Diretor Técnico' },
    { first: 'Ana', last: 'García', role: 'Analista de Contratos' },
    { first: 'Miguel', last: 'Torres', role: 'Gerente de Operações' },
  ]
  const contactsToInsert = accounts!.slice(0, 20).flatMap(acc => {
    const n = randomInt(1, 3)
    return Array.from({ length: n }, (_, i) => {
      const c = CONTACTS_DATA[i % CONTACTS_DATA.length]
      return {
        account_id: acc.id,
        name: `${c.first} ${c.last}`,
        role: c.role,
        email: `${c.first.toLowerCase()}.${c.last.toLowerCase()}@${acc.legal_name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
        phone: `+${randomInt(1, 99)} ${randomInt(10,99)} ${randomInt(1000,9999)}-${randomInt(1000,9999)}`,
        language: ['AR','CL','CO','PE','PY','UY','MX','BO','EC'].includes(acc.country_iso2!) ? 'es' : acc.country_iso2 === 'BR' ? 'pt' : 'en',
      }
    })
  })
  const { data: contacts } = await db.from('contacts').insert(contactsToInsert).select()

  // ─── Quotes ──────────────────────────────────────────────────────────────────
  console.log('📋 Criando cotações...')
  const quotesToInsert = Array.from({ length: 85 }, (_, i) => {
    const account = accounts![i % accounts!.length]
    const stage = random(STAGES_DIST) as any
    const group = random(PRODUCT_GROUPS) as any
    const daysBack = randomInt(0, 180)
    const receivedAt = daysAgo(daysBack)
    const value = randomFloat(5000, 850000, 2)
    const fx = randomFloat(4.9, 5.3, 4)

    return {
      account_id: account.id,
      owner_id: seedUserId,
      quote_number: `PLP-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      quote_type: random(['competitive', 'competitive', 'reposition']) as any,
      stage,
      total_value: value,
      currency: account.currency_default ?? 'USD',
      fx_to_brl: fx,
      probability: stage === 'won' ? 100 : stage === 'lost' ? 0 : randomInt(20, 80),
      product_group: group,
      product_description: random(PRODUCT_DESCRIPTIONS[group] ?? ['Produto']),
      received_at: receivedAt,
      sent_at: ['sent','negotiation','won','lost'].includes(stage) ? daysAgo(randomInt(0, daysBack - 1)) : null,
      decided_at: ['won','lost'].includes(stage) ? daysAgo(randomInt(0, 30)) : null,
      loss_reason: stage === 'lost' ? random(LOSS_REASONS) as any : null,
      loss_competitor: stage === 'lost' && Math.random() > 0.5 ? random(['Preformed Line Products', 'DALEKOVOD', 'AFL', 'Niled', 'Ensto']) : null,
      expected_close_at: Math.random() > 0.4 ? new Date(Date.now() + randomInt(15, 90) * 86400000).toISOString().slice(0,10) : null,
      commission_pct_ds: Math.random() > 0.6 ? randomFloat(0.01, 0.05, 4) : 0,
      commission_pct_dfj: Math.random() > 0.7 ? randomFloat(0.005, 0.03, 4) : 0,
      last_activity_at: daysAgo(randomInt(0, daysBack)),
    }
  })

  const { data: quotes, error: qError } = await db.from('quotes').insert(quotesToInsert).select()
  if (qError) { console.error('Erro quotes:', qError.message); process.exit(1) }
  console.log(`  → ${quotes!.length} cotações`)

  // ─── Quote items ─────────────────────────────────────────────────────────────
  const quoteItems = quotes!.slice(0, 40).flatMap(q => {
    const n = randomInt(1, 5)
    return Array.from({ length: n }, () => {
      const qty = randomInt(50, 2000)
      const unit = randomFloat(10, 500, 4)
      return {
        quote_id: q.id,
        product_code: `PLP-${randomInt(1000,9999)}`,
        description: random(PRODUCT_DESCRIPTIONS[q.product_group ?? 'outros'] ?? ['Item']),
        quantity: qty,
        unit_price: unit,
        total: +(qty * unit).toFixed(2),
      }
    })
  })
  await db.from('quote_items').insert(quoteItems)

  // ─── Orders ──────────────────────────────────────────────────────────────────
  console.log('📦 Criando pedidos...')
  const wonQuotes = quotes!.filter((q: any) => q.stage === 'won')
  const ordersToInsert = Array.from({ length: 22 }, (_, i) => {
    const account = accounts![i % accounts!.length]
    const linkedQuote = i < wonQuotes.length ? wonQuotes[i] : null
    const daysBack = randomInt(5, 120)
    const fx = randomFloat(4.9, 5.3, 4)
    const value = linkedQuote ? linkedQuote.total_value : randomFloat(10000, 500000, 2)

    return {
      account_id: linkedQuote ? linkedQuote.account_id : account.id,
      quote_id: linkedQuote?.id ?? null,
      po_number: `PO-${randomInt(10000, 99999)}`,
      internal_number: `INT-${new Date().getFullYear()}-${String(i + 1).padStart(3,'0')}`,
      status: random(['received','in_production','shipped','delivered','delivered']) as any,
      total_value: value,
      currency: (linkedQuote?.currency ?? 'USD') as string,
      fx_to_brl: fx,
      received_at: daysAgo(daysBack),
      promised_delivery_at: new Date(Date.now() + randomInt(30, 180) * 86400000).toISOString().slice(0,10),
    }
  })
  const { data: orders } = await db.from('orders').insert(ordersToInsert).select()
  console.log(`  → ${orders!.length} pedidos`)

  // ─── Activities ──────────────────────────────────────────────────────────────
  console.log('📋 Criando atividades...')
  const KINDS = ['call','email_sent','email_received','meeting','note','note']
  const activitiesToInsert = Array.from({ length: 110 }, (_, i) => {
    const quote = quotes![i % quotes!.length]
    const kind = random(KINDS)
    return {
      account_id: quote.account_id,
      quote_id: Math.random() > 0.3 ? quote.id : null,
      user_id: seedUserId,
      kind,
      title: {
        call: 'Ligação de follow-up',
        email_sent: 'Email enviado com proposta',
        email_received: 'Resposta recebida do cliente',
        meeting: 'Reunião técnica',
        note: 'Nota interna',
      }[kind] ?? 'Atividade',
      body: [
        'Cliente confirmou interesse na proposta técnica.',
        'Solicitado prazo de entrega atualizado.',
        'Discussão sobre especificação técnica do cabo.',
        'Cliente pediu desconto adicional de 5%.',
        'Engenharia aprovou a especificação.',
        'Aguardando aprovação do orçamento interno do cliente.',
        'Reunião agendada para próxima semana.',
        'Proposta enviada via email para aprovação.',
      ][i % 8],
      occurred_at: daysAgo(randomInt(0, 60)),
    }
  })
  await db.from('activities').insert(activitiesToInsert)

  // ─── Brain alerts ─────────────────────────────────────────────────────────────
  console.log('🧠 Criando brain alerts...')
  const activeQuotes = quotes!.filter((q: any) => ['sent','negotiation','received'].includes(q.stage))
  const alertsToInsert = [
    {
      quote_id: activeQuotes[0]?.id,
      account_id: activeQuotes[0]?.account_id,
      alert_type: 'cooling_quote',
      severity: 'critical',
      title: 'Proposta de alto valor sem resposta há 9 dias',
      body: `${accounts![0].legal_name} não respondeu proposta de USD 650k enviada há 9 dias.`,
      suggested_action: 'Ligar para Carlos Mendoza diretamente.',
      suggested_prompt: `Follow-up urgente com ${accounts![0].legal_name} sobre proposta PLP-${new Date().getFullYear()}-0001. Ligar hoje.`,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    {
      quote_id: activeQuotes[1]?.id,
      account_id: activeQuotes[1]?.account_id,
      alert_type: 'stalled_high_value',
      severity: 'warning',
      title: 'Negociação parada há 12 dias',
      body: 'Cotação em negociação sem movimento. Risco de perda para concorrente.',
      suggested_action: 'Enviar proposta revisada com prazo de entrega melhorado.',
      suggested_prompt: 'Revisar proposta e enviar atualização de prazo de entrega.',
      expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    },
    {
      account_id: accounts![5]?.id,
      alert_type: 'opportunity',
      severity: 'info',
      title: 'Cliente com alto hit rate cotou produto novo',
      body: `${accounts![5]?.legal_name} (hit rate 75%) solicitou OPGW pela primeira vez.`,
      suggested_action: 'Preparar proposta técnica detalhada com case studies.',
      suggested_prompt: `Preparar proposta técnica OPGW para ${accounts![5]?.legal_name}.`,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    },
    {
      quote_id: activeQuotes[2]?.id,
      account_id: activeQuotes[2]?.account_id,
      alert_type: 'deadline_risk',
      severity: 'warning',
      title: 'Prazo de fechamento esperado amanhã',
      body: 'Cotação com expected_close_at amanhã ainda em negociação.',
      suggested_action: 'Confirmar decisão do cliente hoje.',
      suggested_prompt: 'Confirmar status de decisão do cliente urgente.',
      expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    },
    {
      account_id: accounts![10]?.id,
      alert_type: 'unusual_drop',
      severity: 'info',
      title: 'Queda de 45% no volume cotado — Colômbia',
      body: 'Volume cotado na Colômbia caiu 45% vs média dos últimos 3 meses.',
      suggested_action: 'Verificar status dos projetos ativos na região.',
      suggested_prompt: 'Investigar redução de volume na Colômbia e agendar call com ISA.',
      expires_at: new Date(Date.now() + 10 * 86400000).toISOString(),
    },
  ].filter(a => a.account_id)

  await db.from('brain_alerts').insert(alertsToInsert)

  console.log('\n✅ Seed concluído!')
  console.log(`  • ${accounts!.length} accounts`)
  console.log(`  • ${contacts?.length ?? 0} contacts`)
  console.log(`  • ${quotes!.length} quotes`)
  console.log(`  • ${orders!.length} orders`)
  console.log(`  • 5 brain_alerts`)
  console.log('\n📧 Login: owner@plpbrasil.com / PLP@2024!')
}

seed().catch(e => { console.error(e); process.exit(1) })
