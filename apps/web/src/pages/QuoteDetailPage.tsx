import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuote, useUpdateQuoteStage } from '@/hooks/useQuotes'
import { useCreateOrder } from '@/hooks/useOrders'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { StageBadge } from '@/components/StageBadge'
import { TypeBadge } from '@/components/TypeBadge'
import { CountryBadge } from '@/components/CountryBadge'
import { QuoteForm } from '@/components/QuoteForm'
import { formatCurrency, formatDate, formatBRL, daysSince, STAGE_LABELS, PRODUCT_GROUP_LABELS } from '@/lib/utils'
import type { QuoteStage, LossReason } from '@crm-plp/shared'

const STAGES = ['received','in_analysis','sent','negotiation','won','lost','stalled'] as QuoteStage[]
const LOSS_REASONS: Record<string, string> = {
  price: 'Preço', lead_time: 'Prazo', competitor: 'Concorrente',
  specification: 'Especificação', no_response: 'Sem resposta',
  customer_canceled: 'Cliente cancelou', other: 'Outro',
}

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: quote, isLoading } = useQuote(id!)
  const updateStage = useUpdateQuoteStage()
  const createOrder = useCreateOrder()
  const [editing, setEditing] = useState(false)
  const [showLossForm, setShowLossForm] = useState(false)
  const [lossForm, setLossForm] = useState({ reason: 'price' as LossReason, competitor: '', notes: '' })
  const [showConvertForm, setShowConvertForm] = useState(false)
  const [convertForm, setConvertForm] = useState({ po_number: '', internal_number: '', fx_to_brl: '', promised_delivery_at: '' })

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400">Carregando...</div>
  if (!quote) return <div className="flex items-center justify-center h-full text-gray-400">Cotação não encontrada</div>

  async function handleStageChange(newStage: string) {
    if (newStage === 'lost') { setShowLossForm(true); return }
    await updateStage.mutateAsync({
      id: id!,
      stage: newStage,
      ...(newStage === 'sent' ? { sent_at: new Date().toISOString() } : {}),
    })
  }

  async function handleMarkLost() {
    await updateStage.mutateAsync({
      id: id!,
      stage: 'lost',
      loss_reason: lossForm.reason,
      loss_competitor: lossForm.competitor || null,
      loss_notes: lossForm.notes || null,
    })
    setShowLossForm(false)
  }

  async function handleConvert() {
    const order = await createOrder.mutateAsync({
      account_id: quote.account_id,
      quote_id: id!,
      po_number: convertForm.po_number || null,
      internal_number: convertForm.internal_number || null,
      status: 'received',
      total_value: quote.total_value!,
      currency: quote.currency,
      fx_to_brl: parseFloat(convertForm.fx_to_brl) || quote.fx_to_brl!,
      received_at: new Date().toISOString(),
      promised_delivery_at: convertForm.promised_delivery_at || null,
    })
    await updateStage.mutateAsync({ id: id!, stage: 'won' })
    setShowConvertForm(false)
    navigate(`/pedidos/${order.id}`)
  }

  const canConvert = quote.stage === 'sent' || quote.stage === 'negotiation'

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-700 mb-1">← Voltar</button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">{quote.quote_number}</h1>
              <StageBadge stage={quote.stage} />
              <TypeBadge type={quote.quote_type} />
              {quote.probability != null && (
                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">
                  {quote.probability}% prob.
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={() => navigate(`/contas/${quote.account_id}`)} className="text-sm font-medium hover:underline">
                {quote.account?.legal_name}
              </button>
              <CountryBadge iso2={quote.account?.country_iso2} country={quote.account?.country} />
              <span className="text-xs text-gray-400">{daysSince(quote.received_at)}d desde recebimento</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canConvert && (
              <button onClick={() => setShowConvertForm(true)} className="btn-primary text-xs">
                ↗ Converter em Pedido
              </button>
            )}
            <button onClick={() => setEditing(e => !e)} className="btn-secondary text-xs">
              {editing ? 'Cancelar' : 'Editar'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col p-6 gap-6 min-w-0">
          {editing ? (
            <QuoteForm
              initial={{ id, ...quote }}
              onSuccess={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="label">Valor</p>
                  <p className="text-sm font-semibold">{formatCurrency(quote.total_value, quote.currency)}</p>
                  {quote.total_value && quote.fx_to_brl && (
                    <p className="text-xs text-gray-400">{formatBRL(quote.total_value * quote.fx_to_brl)}</p>
                  )}
                </div>
                <div>
                  <p className="label">Grupo de Produto</p>
                  <p className="text-sm">{quote.product_group ? PRODUCT_GROUP_LABELS[quote.product_group] : '—'}</p>
                </div>
                <div>
                  <p className="label">Recebida em</p>
                  <p className="text-sm">{formatDate(quote.received_at)}</p>
                </div>
                <div>
                  <p className="label">Enviada em</p>
                  <p className="text-sm">{formatDate(quote.sent_at)}</p>
                </div>
                <div>
                  <p className="label">Previsão fechamento</p>
                  <p className="text-sm">{formatDate(quote.expected_close_at)}</p>
                </div>
                <div>
                  <p className="label">FX BRL</p>
                  <p className="text-sm">{quote.fx_to_brl ?? '—'}</p>
                </div>
                {quote.product_description && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="label">Descrição</p>
                    <p className="text-sm">{quote.product_description}</p>
                  </div>
                )}
                {(quote.commission_pct_ds > 0 || quote.commission_pct_dfj > 0) && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="label">Comissões</p>
                    <div className="flex gap-3 text-xs text-gray-500">
                      {quote.commission_pct_ds > 0 && <span>DS: {(quote.commission_pct_ds * 100).toFixed(1)}%</span>}
                      {quote.commission_pct_dfj > 0 && <span>DFJ: {(quote.commission_pct_dfj * 100).toFixed(1)}%</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Stage change */}
              {!['won','lost','expired'].includes(quote.stage) && (
                <div>
                  <p className="label mb-2">Mover para</p>
                  <div className="flex gap-2 flex-wrap">
                    {STAGES.filter(s => s !== quote.stage).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStageChange(s)}
                        disabled={updateStage.isPending}
                        className="btn-secondary text-xs"
                      >
                        {STAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loss info */}
              {quote.stage === 'lost' && quote.loss_reason && (
                <div className="card p-3 border-red-200 dark:border-red-900">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Motivo da perda</p>
                  <p className="text-sm">{LOSS_REASONS[quote.loss_reason]}</p>
                  {quote.loss_competitor && <p className="text-xs text-gray-500 mt-1">Concorrente: {quote.loss_competitor}</p>}
                  {quote.loss_notes && <p className="text-xs text-gray-500 mt-1">{quote.loss_notes}</p>}
                </div>
              )}

              {/* Items */}
              {quote.items && quote.items.length > 0 && (
                <div>
                  <p className="label mb-2">Itens ({quote.items.length})</p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left py-1 px-2 text-gray-500">Código</th>
                        <th className="text-left py-1 px-2 text-gray-500">Descrição</th>
                        <th className="text-right py-1 px-2 text-gray-500">Qtd</th>
                        <th className="text-right py-1 px-2 text-gray-500">Preço Unit.</th>
                        <th className="text-right py-1 px-2 text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items.map((item: any) => (
                        <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-1 px-2 font-mono">{item.product_code ?? '—'}</td>
                          <td className="py-1 px-2">{item.description ?? '—'}</td>
                          <td className="py-1 px-2 text-right">{item.quantity}</td>
                          <td className="py-1 px-2 text-right">{formatCurrency(item.unit_price, quote.currency)}</td>
                          <td className="py-1 px-2 text-right font-medium">{formatCurrency(item.total, quote.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Activity sidebar */}
        <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
          <ActivityTimeline quoteId={id} accountId={quote.account_id} />
        </div>
      </div>

      {/* Loss modal */}
      {showLossForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-md p-5 shadow-xl animate-fade-in">
            <h2 className="font-semibold mb-4">Registrar Perda</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Motivo *</label>
                <select value={lossForm.reason} onChange={e => setLossForm(f => ({ ...f, reason: e.target.value as LossReason }))} className="input">
                  {Object.entries(LOSS_REASONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Concorrente</label>
                <input value={lossForm.competitor} onChange={e => setLossForm(f => ({ ...f, competitor: e.target.value }))} className="input" placeholder="Nome do concorrente" />
              </div>
              <div>
                <label className="label">Observações</label>
                <textarea value={lossForm.notes} onChange={e => setLossForm(f => ({ ...f, notes: e.target.value }))} className="input resize-none" rows={3} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowLossForm(false)} className="btn-ghost">Cancelar</button>
                <button onClick={handleMarkLost} className="btn-danger">Confirmar Perda</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert to order modal */}
      {showConvertForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-md p-5 shadow-xl animate-fade-in">
            <h2 className="font-semibold mb-1">Converter em Pedido</h2>
            <p className="text-xs text-gray-500 mb-4">Cotação será marcada como "Ganha" automaticamente.</p>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nº PO do cliente</label>
                  <input value={convertForm.po_number} onChange={e => setConvertForm(f => ({ ...f, po_number: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Nº interno</label>
                  <input value={convertForm.internal_number} onChange={e => setConvertForm(f => ({ ...f, internal_number: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">FX BRL</label>
                  <input type="number" step="0.0001" value={convertForm.fx_to_brl} onChange={e => setConvertForm(f => ({ ...f, fx_to_brl: e.target.value }))} className="input" placeholder={String(quote.fx_to_brl ?? '5.1')} />
                </div>
                <div>
                  <label className="label">Entrega prevista</label>
                  <input type="date" value={convertForm.promised_delivery_at} onChange={e => setConvertForm(f => ({ ...f, promised_delivery_at: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConvertForm(false)} className="btn-ghost">Cancelar</button>
                <button onClick={handleConvert} disabled={createOrder.isPending} className="btn-primary">
                  {createOrder.isPending ? 'Convertendo...' : 'Confirmar Pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
