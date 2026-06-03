import type { RequestStatus } from '@crm-plp/shared'

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'Nova',
  quoting: 'Em cotação',
  quoted: 'Cotada',
  discarded: 'Descartada',
}

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  quoting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  quoted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  discarded: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export function waitingDays(receivedAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(receivedAt).getTime()) / 86_400_000))
}

export function waitingLabel(receivedAt: string, now: number = Date.now()): string {
  const d = waitingDays(receivedAt, now)
  if (d === 0) return 'chegou hoje'
  if (d === 1) return 'aguardando há 1 dia'
  return `aguardando há ${d} dias`
}
