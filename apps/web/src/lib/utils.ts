import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(value: number | null, currency = 'USD'): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatBRL(value: number | null): string {
  return formatCurrency(value, 'BRL')
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(date))
}

export function formatRelativeDate(date: string | null): string {
  if (!date) return '—'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return `${diffDays}d atrás`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}m atrás`
  return `${Math.floor(diffDays / 365)}a atrás`
}

export function daysSince(date: string | null): number {
  if (!date) return 0
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

export function priorityScore(quote: {
  total_value: number | null
  fx_to_brl: number | null
  stage: string
  days_in_stage: number
  has_active_alert: boolean
}): number {
  let score = 0
  const valueBrl = (quote.total_value ?? 0) * (quote.fx_to_brl ?? 5.1)
  score += Math.log10(valueBrl + 1) * 10
  if (quote.stage === 'received' && quote.days_in_stage > 2) score += 30
  if (quote.stage === 'sent' && quote.days_in_stage > 5) score += 20
  if (quote.stage === 'negotiation' && quote.days_in_stage > 10) score += 40
  if (quote.has_active_alert) score += 50
  return score
}

export const STAGE_LABELS: Record<string, string> = {
  received: 'Recebida',
  in_analysis: 'Em análise',
  sent: 'Enviada',
  negotiation: 'Negociação',
  won: 'Ganha',
  lost: 'Perdida',
  expired: 'Expirada',
  stalled: 'Parada',
}

export const STAGE_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_analysis: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  won: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  stalled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
}

export const PRODUCT_GROUP_LABELS: Record<string, string> = {
  preformados: 'Preformados',
  cadeias: 'Cadeias',
  svd_amortecedor: 'SVD/Amortecedor',
  opgw_fibra: 'OPGW/Fibra',
  cruzeta: 'Cruzeta',
  ferragens: 'Ferragens',
  isoladores: 'Isoladores',
  conectores: 'Conectores',
  outros: 'Outros',
}

export const QUOTE_TYPE_LABELS: Record<string, string> = {
  competitive: 'Comp',
  reposition: 'Repos',
}

export const ALERT_SEVERITY_COLORS: Record<string, string> = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
}
