import { describe, it, expect } from 'vitest'
import { STAGE_DEFAULT_PROBABILITY, effectiveProbability } from '@crm-plp/shared'

describe('effectiveProbability', () => {
  it('usa probabilidade explícita quando informada', () => {
    expect(effectiveProbability('negotiation', 72)).toBe(72)
  })

  it('aplica default do estágio quando null', () => {
    expect(effectiveProbability('negotiation', null)).toBe(STAGE_DEFAULT_PROBABILITY.negotiation)
    expect(effectiveProbability('sent', undefined)).toBe(35)
  })
})
