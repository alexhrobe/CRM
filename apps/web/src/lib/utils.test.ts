import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatCurrency,
  formatBRL,
  formatRelativeDate,
  daysSince,
  priorityScore,
  STAGE_LABELS,
  STAGE_COLORS,
} from './utils'

describe('formatCurrency', () => {
  it('returns the em-dash placeholder for null/undefined', () => {
    expect(formatCurrency(null)).toBe('—')
  })

  it('formats USD with pt-BR grouping and no decimals', () => {
    const out = formatCurrency(1_000_000, 'USD')
    expect(out).toMatch(/1\.000\.000/)
    expect(out).not.toMatch(/,\d{2}$/) // no cents
  })

  it('formatBRL delegates with BRL currency', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(2500)).toMatch(/2\.500/)
  })
})

describe('daysSince', () => {
  afterEach(() => vi.useRealTimers())

  it('returns 0 for null', () => {
    expect(daysSince(null)).toBe(0)
  })

  it('counts whole days elapsed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-11T12:00:00Z'))
    expect(daysSince('2024-06-01T12:00:00Z')).toBe(10)
  })
})

describe('formatRelativeDate', () => {
  afterEach(() => vi.useRealTimers())

  it('returns placeholder for null', () => {
    expect(formatRelativeDate(null)).toBe('—')
  })

  it('labels recent days in Portuguese', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
    expect(formatRelativeDate('2024-06-15T09:00:00Z')).toBe('hoje')
    expect(formatRelativeDate('2024-06-14T09:00:00Z')).toBe('ontem')
    expect(formatRelativeDate('2024-06-12T09:00:00Z')).toBe('3d atrás')
    expect(formatRelativeDate('2024-06-01T09:00:00Z')).toBe('2sem atrás')
  })
})

describe('priorityScore', () => {
  const base = {
    total_value: null,
    fx_to_brl: null,
    stage: 'received',
    days_in_stage: 0,
    has_active_alert: false,
  }

  it('is zero when there is no value, no aging and no alert', () => {
    expect(priorityScore(base)).toBe(0)
  })

  it('grows with deal value (log scale)', () => {
    const small = priorityScore({ ...base, total_value: 1_000, fx_to_brl: 5 })
    const big = priorityScore({ ...base, total_value: 1_000_000, fx_to_brl: 5 })
    expect(big).toBeGreaterThan(small)
  })

  it('penalises quotes stuck in negotiation', () => {
    const fresh = priorityScore({ ...base, stage: 'negotiation', days_in_stage: 3 })
    const stale = priorityScore({ ...base, stage: 'negotiation', days_in_stage: 11 })
    expect(stale - fresh).toBe(40)
  })

  it('adds a fixed boost for active alerts', () => {
    const without = priorityScore(base)
    const withAlert = priorityScore({ ...base, has_active_alert: true })
    expect(withAlert - without).toBe(50)
  })
})

describe('label/color maps', () => {
  it('cover every quote stage with a label and a color class', () => {
    const stages = Object.keys(STAGE_LABELS)
    expect(stages.length).toBeGreaterThan(0)
    for (const stage of stages) {
      expect(STAGE_COLORS[stage]).toBeTruthy()
    }
  })
})
