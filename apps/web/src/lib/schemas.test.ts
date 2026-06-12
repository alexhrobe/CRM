import { describe, it, expect } from 'vitest'
import { CreateQuoteSchema, QuoteStage, AccountType } from '@crm-plp/shared'

describe('CreateQuoteSchema', () => {
  const valid = {
    account_id: '11111111-1111-1111-1111-111111111111',
    quote_number: 'EXP-2024-001',
    quote_type: 'competitive' as const,
    total_value: 50_000,
    received_at: '2024-06-01',
    product_group: null,
    product_description: null,
    expected_close_at: null,
    commission_other_label: null,
  }

  it('accepts a well-formed quote and applies defaults', () => {
    const parsed = CreateQuoteSchema.parse(valid)
    expect(parsed.stage).toBe('received') // default
    expect(parsed.currency).toBe('USD') // default
    expect(parsed.commission_pct_ds).toBe(0)
  })

  it('rejects a non-uuid account_id', () => {
    const result = CreateQuoteSchema.safeParse({ ...valid, account_id: 'nope' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive total_value', () => {
    const result = CreateQuoteSchema.safeParse({ ...valid, total_value: -1 })
    expect(result.success).toBe(false)
  })

  it('requires a quote_number', () => {
    const result = CreateQuoteSchema.safeParse({ ...valid, quote_number: '' })
    expect(result.success).toBe(false)
  })
})

describe('domain enums', () => {
  it('QuoteStage covers the full pipeline', () => {
    expect(QuoteStage.options).toContain('won')
    expect(QuoteStage.options).toContain('lost')
    expect(QuoteStage.safeParse('teleported').success).toBe(false)
  })

  it('AccountType rejects unknown types', () => {
    expect(AccountType.safeParse('direct_customer').success).toBe(true)
    expect(AccountType.safeParse('alien').success).toBe(false)
  })
})
