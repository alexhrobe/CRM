/**
 * Motor de regras de automação — determinístico, sem IA.
 *
 * As tarefas são DERIVADAS do pipeline (não persistidas): assim que você
 * registra uma atividade na cotação (atualizando last_activity_at) ou ela muda
 * de estágio, a tarefa correspondente some sozinha. Sem tarefa fantasma.
 *
 * Funções puras (recebem `now`) — fáceis de testar e de rodar no cliente.
 */
import type { PipelineQuote, AlertSeverity } from '@crm-plp/shared'

export type TaskKind = 'followup' | 'expiring' | 'stalled'

export interface AutomationTask {
  id: string
  quoteId: string
  quoteNumber: string
  accountName: string
  countryIso2: string | null
  stage: string
  kind: TaskKind
  severity: AlertSeverity
  title: string
  detail: string
  totalValue: number | null
  currency: string
  overdueDays: number // >0 = atrasada
  dueInDays: number | null // dias até vencer (validade)
  sortValueBrl: number
}

/** Limites das regras — ajuste num só lugar. */
export const AUTOMATION_CONFIG = {
  followupSentDays: 3, // 'enviada' sem atividade
  stalledNegotiationDays: 10, // parada em 'negociação'
  stalledAnalysisDays: 5, // parada em 'em análise'
  validityDays: 30, // validade padrão (se não houver expected_close_at)
  expiringWithinDays: 5, // antecedência do alerta de validade
} as const
export type AutomationConfig = typeof AUTOMATION_CONFIG

const DAY = 86_400_000
const OPEN_STAGES = ['received', 'in_analysis', 'sent', 'negotiation', 'stalled']

const daysSince = (iso: string | null, now: number) =>
  iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : 0
const daysUntil = (iso: string, now: number) =>
  Math.ceil((new Date(iso).getTime() - now) / DAY)
const addDays = (iso: string, n: number) =>
  new Date(new Date(iso).getTime() + n * DAY).toISOString()

export function deriveTasksForQuote(
  q: PipelineQuote,
  now: number,
  cfg: AutomationConfig = AUTOMATION_CONFIG,
): AutomationTask[] {
  if (!OPEN_STAGES.includes(q.stage)) return []
  const base = {
    quoteId: q.id,
    quoteNumber: q.quote_number,
    accountName: q.account_name,
    countryIso2: q.country_iso2,
    stage: q.stage,
    totalValue: q.total_value,
    currency: q.currency,
    sortValueBrl: q.total_value_brl ?? 0,
  }
  const tasks: AutomationTask[] = []

  // 1. Follow-up de cotação enviada
  if (q.stage === 'sent') {
    const d = daysSince(q.last_activity_at, now)
    if (d >= cfg.followupSentDays) {
      tasks.push({
        ...base,
        id: `${q.id}:followup`,
        kind: 'followup',
        severity: d >= 7 ? 'critical' : 'warning',
        title: 'Follow-up da proposta enviada',
        detail: `Sem resposta há ${d} dias`,
        overdueDays: d - cfg.followupSentDays,
        dueInDays: null,
      })
    }
  }

  // 2. Negociação / análise parada
  if (q.stage === 'negotiation' && q.days_in_stage > cfg.stalledNegotiationDays) {
    const d = Math.round(q.days_in_stage)
    tasks.push({
      ...base,
      id: `${q.id}:stalled`,
      kind: 'stalled',
      severity: d >= cfg.stalledNegotiationDays * 1.5 ? 'critical' : 'warning',
      title: 'Negociação parada — destravar',
      detail: `Há ${d} dias em negociação`,
      overdueDays: d - cfg.stalledNegotiationDays,
      dueInDays: null,
    })
  }
  if (q.stage === 'in_analysis' && q.days_in_stage > cfg.stalledAnalysisDays) {
    const d = Math.round(q.days_in_stage)
    tasks.push({
      ...base,
      id: `${q.id}:stalled`,
      kind: 'stalled',
      severity: 'warning',
      title: 'Análise parada — avançar',
      detail: `Há ${d} dias em análise`,
      overdueDays: d - cfg.stalledAnalysisDays,
      dueInDays: null,
    })
  }

  // 3. Validade expirando / vencida
  const validUntil = q.expected_close_at ?? addDays(q.received_at, cfg.validityDays)
  const du = daysUntil(validUntil, now)
  if (du < 0) {
    tasks.push({
      ...base,
      id: `${q.id}:expiring`,
      kind: 'expiring',
      severity: 'critical',
      title: 'Validade vencida',
      detail: `Venceu há ${Math.abs(du)} dias`,
      overdueDays: Math.abs(du),
      dueInDays: du,
    })
  } else if (du <= cfg.expiringWithinDays) {
    tasks.push({
      ...base,
      id: `${q.id}:expiring`,
      kind: 'expiring',
      severity: du <= 1 ? 'critical' : 'warning',
      title: 'Validade expirando',
      detail: du === 0 ? 'Vence hoje' : `Vence em ${du} dias`,
      overdueDays: 0,
      dueInDays: du,
    })
  }

  return tasks
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

/** Deriva e ordena (urgência → atraso → valor) todas as tarefas do pipeline. */
export function deriveTasks(
  quotes: PipelineQuote[],
  now: number = Date.now(),
  cfg: AutomationConfig = AUTOMATION_CONFIG,
): AutomationTask[] {
  return quotes
    .flatMap((q) => deriveTasksForQuote(q, now, cfg))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.overdueDays - a.overdueDays ||
        b.sortValueBrl - a.sortValueBrl,
    )
}

/** Agrupa para o painel "Hoje". */
export function groupTasks(tasks: AutomationTask[]) {
  return {
    urgentes: tasks.filter((t) => t.severity === 'critical'),
    atencao: tasks.filter((t) => t.severity === 'warning'),
    total: tasks.length,
  }
}
