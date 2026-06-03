// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { InboxPage } from './InboxPage'

// Integração: o InboxPage consome usePipelineQuotes -> client (modo demo, pois
// não há env Supabase em teste) -> dados-semente. Prova o caminho completo
// dado -> hook -> render, incluindo a priorização e o agrupamento por estágio.
function renderInbox() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InboxPage (integração com o client em modo demo)', () => {
  it('renderiza cotações do pipeline vindas do client', async () => {
    renderInbox()
    // quote_number é único por cotação
    expect(await screen.findByText('PLP-2024-0312')).toBeTruthy()
  })

  it('agrupa em "Precisa de você agora" e "Aguardando cliente"', async () => {
    renderInbox()
    expect(await screen.findByText(/Precisa de você agora/i)).toBeTruthy()
    expect(await screen.findByText(/Aguardando cliente/i)).toBeTruthy()
  })

  it('mostra a faixa de KPIs do mês corrente', async () => {
    renderInbox()
    expect(await screen.findByText('Valor Cotado')).toBeTruthy()
    expect(await screen.findByText('Cotações Recebidas')).toBeTruthy()
  })
})
