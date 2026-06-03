import { describe, it, expect } from 'vitest'
import { waitingDays, waitingLabel, REQUEST_STATUS_LABELS, REQUEST_STATUS_COLORS } from './format'

const NOW = new Date('2025-06-10T12:00:00Z').getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('fila de solicitações — formatação', () => {
  it('conta dias de espera (nunca negativo)', () => {
    expect(waitingDays(daysAgo(5), NOW)).toBe(5)
    expect(waitingDays(daysAgo(0), NOW)).toBe(0)
    expect(waitingDays(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0)
  })

  it('rotula a espera em português', () => {
    expect(waitingLabel(daysAgo(0), NOW)).toBe('chegou hoje')
    expect(waitingLabel(daysAgo(1), NOW)).toBe('aguardando há 1 dia')
    expect(waitingLabel(daysAgo(4), NOW)).toBe('aguardando há 4 dias')
  })

  it('cobre todos os status com rótulo e cor', () => {
    for (const k of Object.keys(REQUEST_STATUS_LABELS) as (keyof typeof REQUEST_STATUS_LABELS)[]) {
      expect(REQUEST_STATUS_LABELS[k]).toBeTruthy()
      expect(REQUEST_STATUS_COLORS[k]).toBeTruthy()
    }
  })
})
