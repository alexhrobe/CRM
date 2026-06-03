import { describe, it, expect } from 'vitest'
import type { ParsedProposal } from '@crm-plp/shared'
import { importProposal } from './importProposal'

// Roda em modo demo (VITE_DEMO=1 no vitest.config) → client em memória.
// Garante que o fluxo dedupe -> conta -> cotação -> itens executa ponta a ponta.
const sample: ParsedProposal = {
  account: { legal_name: 'Elecnor Chile S.A.', country: 'Chile', country_iso2: 'CL', segment: null },
  contact: { name: 'María González', email: 'maria@elecnor.cl', phone: null, role: null },
  quote: {
    quote_number: 'PLP-2025-0420',
    quote_type: 'competitive',
    currency: 'USD',
    total_value: 16500,
    product_group: 'opgw_fibra',
    product_description: 'OPGW + ferragens',
    received_at: new Date().toISOString(),
    expected_close_at: null,
  },
  items: [
    { product_code: 'OPGW-48', description: 'Cabo OPGW 48 fibras', quantity: 1000, unit_price: 12.5, total: 12500 },
    { product_code: 'FER-230', description: 'Ferragens 230kV', quantity: 50, unit_price: 80, total: 4000 },
  ],
}

describe('importProposal', () => {
  it('executa o fluxo e devolve um quoteId', async () => {
    const res = await importProposal(sample, 'demo-owner')
    expect(typeof res.quoteId).toBe('string')
    expect(res.quoteId.length).toBeGreaterThan(0)
    expect(typeof res.accountId).toBe('string')
    expect(typeof res.reusedAccount).toBe('boolean')
  })
})
