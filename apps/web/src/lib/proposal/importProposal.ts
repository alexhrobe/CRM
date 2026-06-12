/**
 * Persiste uma proposta extraída: reaproveita a conta se já existir (casa pelo
 * nome), senão cria; cria o contato (se houver), a cotação e os itens.
 *
 * Tenta primeiro a RPC `import_proposal` (transação atômica, migration 10+).
 * Se a função ainda não existir no banco remoto, faz o fluxo direto via API.
 * A planilha de origem não é armazenada.
 */
import { supabase } from '@/lib/supabase'
import type { ParsedProposal } from '@crm-plp/shared'
import type { Json } from '@/lib/database.types'

export interface ImportResult {
  quoteId: string
  accountId: string
  reusedAccount: boolean
}

function isRpcUnavailable(error: { code?: string; message?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? ''
  return (
    error.code === 'PGRST202' ||
    msg.includes('import_proposal') ||
    msg.includes('could not find the function')
  )
}

/** Fluxo direto (várias chamadas) — funciona sem migration 10. */
async function importProposalDirect(
  proposal: ParsedProposal,
  ownerId: string,
): Promise<ImportResult> {
  let accountId: string
  let reusedAccount = false

  const { data: matches, error: findErr } = await supabase
    .from('accounts')
    .select('id')
    .ilike('legal_name', proposal.account.legal_name)
    .limit(1)
  if (findErr) throw findErr

  if (matches && matches.length > 0) {
    accountId = matches[0].id
    reusedAccount = true
  } else {
    const { data: acc, error } = await supabase
      .from('accounts')
      .insert({
        legal_name: proposal.account.legal_name,
        country: proposal.account.country,
        country_iso2: proposal.account.country_iso2 ?? null,
        account_type: 'direct_customer',
        currency_default: proposal.quote.currency,
        segment: proposal.account.segment ?? null,
      })
      .select('id')
      .single()
    if (error) throw error
    accountId = acc!.id
  }

  if (proposal.contact?.name) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('account_id', accountId)
      .ilike('name', proposal.contact.name)
      .limit(1)
    if (!existing || existing.length === 0) {
      await supabase.from('contacts').insert({
        account_id: accountId,
        name: proposal.contact.name,
        email: proposal.contact.email ?? null,
        phone: proposal.contact.phone ?? null,
        role: proposal.contact.role ?? null,
      })
    }
  }

  const { data: fxRows } = await supabase
    .from('fx_rates')
    .select('rate_to_brl')
    .eq('currency', proposal.quote.currency)
    .order('date', { ascending: false })
    .limit(1)
  const fxToBrl = fxRows?.[0]?.rate_to_brl ?? null

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .insert({
      account_id: accountId,
      owner_id: ownerId,
      quote_number: proposal.quote.quote_number,
      quote_type: proposal.quote.quote_type,
      stage: 'received',
      total_value: proposal.quote.total_value,
      currency: proposal.quote.currency,
      fx_to_brl: fxToBrl,
      product_group: proposal.quote.product_group ?? null,
      product_description: proposal.quote.product_description ?? null,
      received_at: proposal.quote.received_at,
      expected_close_at: proposal.quote.expected_close_at ?? null,
    })
    .select('id')
    .single()
  if (qErr) throw qErr
  const quoteId = quote!.id

  if (proposal.items.length > 0) {
    const { error: itErr } = await supabase.from('quote_items').insert(
      proposal.items.map((it) => ({
        quote_id: quoteId,
        product_code: it.product_code,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total: it.total,
      })),
    )
    if (itErr) throw itErr
  }

  return { quoteId, accountId, reusedAccount }
}

export async function importProposal(
  proposal: ParsedProposal,
  ownerId: string,
): Promise<ImportResult> {
  const { data, error } = await supabase.rpc('import_proposal', {
    p_proposal: proposal as unknown as Json,
    p_owner_id: ownerId,
  })

  if (!error) {
    const result = data as unknown as ImportResult | null
    if (result?.quoteId) return result
  }

  if (error && !isRpcUnavailable(error)) throw error

  return importProposalDirect(proposal, ownerId)
}
