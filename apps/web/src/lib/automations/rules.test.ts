import { describe, it, expect } from 'vitest'
import type { PipelineQuote } from '@crm-plp/shared'
import { deriveTasks, deriveTasksForQuote } from './rules'

const NOW = new Date('2025-06-10T12:00:00Z').getTime()
const DAY = 86_400_000
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString()
const daysAhead = (n: number) => new Date(NOW + n * DAY).toISOString()

function pq(over: Partial<PipelineQuote>): PipelineQuote {
  return {
    id: 'q1', account_id: 'a1', owner_id: 'o1', assistant_id: null, quote_number: 'PLP-1',
    quote_type: 'competitive', stage: 'sent', total_value: 1000, currency: 'USD', fx_to_brl: 5,
    probability: null, product_group: null, product_description: null,
    received_at: daysAgo(1), sent_at: daysAgo(1), expected_close_at: null, decided_at: null,
    loss_reason: null, loss_competitor: null, loss_notes: null,
    commission_pct_ds: 0, commission_pct_dfj: 0, commission_pct_other: 0, commission_other_label: null,
    last_activity_at: daysAgo(0), created_at: daysAgo(1), updated_at: daysAgo(0),
    account_name: 'ACME', country: 'Chile', country_iso2: 'CL', days_in_stage: 0,
    total_value_brl: 5000, has_active_alert: false, alert_severity: null, alert_title: null,
    ...over,
  } as PipelineQuote
}
const kinds = (q: PipelineQuote) => deriveTasksForQuote(q, NOW).map((t) => t.kind)

describe('regras de automação', () => {
  it('cria follow-up para cotação enviada sem atividade (>=3d) e escala para crítico (>=7d)', () => {
    expect(kinds(pq({ stage: 'sent', last_activity_at: daysAgo(2) }))).not.toContain('followup')
    const warn = deriveTasksForQuote(pq({ stage: 'sent', last_activity_at: daysAgo(4) }), NOW)
    expect(warn.find((t) => t.kind === 'followup')?.severity).toBe('warning')
    const crit = deriveTasksForQuote(pq({ stage: 'sent', last_activity_at: daysAgo(9) }), NOW)
    expect(crit.find((t) => t.kind === 'followup')?.severity).toBe('critical')
  })

  it('sinaliza negociação parada além do limite', () => {
    expect(kinds(pq({ stage: 'negotiation', days_in_stage: 8 }))).not.toContain('stalled')
    const t = deriveTasksForQuote(pq({ stage: 'negotiation', days_in_stage: 16 }), NOW)
    expect(t.find((x) => x.kind === 'stalled')?.severity).toBe('critical')
  })

  it('sinaliza análise parada (>5d)', () => {
    expect(kinds(pq({ stage: 'in_analysis', days_in_stage: 6, received_at: daysAgo(6) }))).toContain('stalled')
  })

  it('alerta validade expirando e vencida', () => {
    const soon = deriveTasksForQuote(pq({ stage: 'sent', expected_close_at: daysAhead(3) }), NOW)
    expect(soon.find((t) => t.kind === 'expiring')?.detail).toMatch(/3 dias/)
    const past = deriveTasksForQuote(pq({ stage: 'negotiation', days_in_stage: 5, expected_close_at: daysAgo(2) }), NOW)
    expect(past.find((t) => t.kind === 'expiring')?.severity).toBe('critical')
  })

  it('usa validade padrão (received + 30d) quando não há expected_close_at', () => {
    const t = deriveTasksForQuote(pq({ stage: 'stalled', received_at: daysAgo(40), expected_close_at: null }), NOW)
    expect(t.find((x) => x.kind === 'expiring')?.title).toBe('Validade vencida')
  })

  it('não gera tarefas para estágios fechados', () => {
    expect(deriveTasksForQuote(pq({ stage: 'won' }), NOW)).toHaveLength(0)
    expect(deriveTasksForQuote(pq({ stage: 'lost' }), NOW)).toHaveLength(0)
  })

  it('uma cotação pode gerar várias tarefas (parada + expirando)', () => {
    const k = kinds(pq({ stage: 'negotiation', days_in_stage: 20, expected_close_at: daysAhead(1) }))
    expect(k).toContain('stalled')
    expect(k).toContain('expiring')
  })

  it('ordena por urgência (críticas primeiro)', () => {
    const quotes = [
      pq({ id: 'a', stage: 'in_analysis', days_in_stage: 6, received_at: daysAgo(6) }), // warning
      pq({ id: 'b', stage: 'sent', last_activity_at: daysAgo(10) }), // critical
    ]
    const tasks = deriveTasks(quotes, NOW)
    expect(tasks[0].severity).toBe('critical')
  })
})
