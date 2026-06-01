import { useParams, useNavigate } from 'react-router-dom'
import { useOrder, useUpdateOrder } from '@/hooks/useOrders'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { formatCurrency, formatDate, formatBRL } from '@/lib/utils'
import type { OrderStatus } from '@crm-plp/shared'

const STATUS_LABELS: Record<string, string> = {
  received: 'Recebido', in_production: 'Em Produção',
  shipped: 'Embarcado', delivered: 'Entregue', canceled: 'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_production: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const STATUSES: OrderStatus[] = ['received','in_production','shipped','delivered','canceled']

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(id!)
  const updateOrder = useUpdateOrder()

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400">Carregando...</div>
  if (!order) return <div className="flex items-center justify-center h-full text-gray-400">Pedido não encontrado</div>

  async function handleStatusChange(status: OrderStatus) {
    await updateOrder.mutateAsync({ id: id!, status })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-700 mb-1">← Voltar</button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">
                {order.po_number ?? order.internal_number ?? `Pedido ${id!.slice(0,8)}`}
              </h1>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <button onClick={() => navigate(`/contas/${order.account_id}`)} className="text-sm font-medium hover:underline mt-1">
              {order.account?.legal_name}
            </button>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{formatCurrency(order.total_value, order.currency)}</p>
            {order.fx_to_brl && (
              <p className="text-xs text-gray-400">{formatBRL(order.total_value * order.fx_to_brl)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-0">
        <div className="flex-1 p-6 flex flex-col gap-6 min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="label">PO do Cliente</p>
              <p className="text-sm">{order.po_number ?? '—'}</p>
            </div>
            <div>
              <p className="label">Nº Interno</p>
              <p className="text-sm">{order.internal_number ?? '—'}</p>
            </div>
            <div>
              <p className="label">Recebido em</p>
              <p className="text-sm">{formatDate(order.received_at)}</p>
            </div>
            <div>
              <p className="label">Entrega prevista</p>
              <p className="text-sm">{formatDate(order.promised_delivery_at)}</p>
            </div>
            <div>
              <p className="label">FX BRL</p>
              <p className="text-sm">{order.fx_to_brl}</p>
            </div>
            {order.quote && (
              <div>
                <p className="label">Cotação origem</p>
                <button
                  onClick={() => navigate(`/cotacoes/${order.quote_id}`)}
                  className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {order.quote.quote_number}
                </button>
              </div>
            )}
          </div>

          {/* Status progression */}
          {order.status !== 'canceled' && order.status !== 'delivered' && (
            <div>
              <p className="label mb-2">Atualizar status</p>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.filter(s => s !== order.status && s !== 'canceled').map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={updateOrder.isPending}
                    className="btn-secondary text-xs"
                  >
                    → {STATUS_LABELS[s]}
                  </button>
                ))}
                <button
                  onClick={() => handleStatusChange('canceled')}
                  disabled={updateOrder.isPending}
                  className="btn-danger text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div>
              <p className="label mb-2">Itens ({order.items.length})</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    {['Código','Descrição','Qtd','Preço Unit.','Total'].map(h => (
                      <th key={h} className={`text-left py-1 px-2 text-gray-500 ${h !== 'Código' && h !== 'Descrição' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-1 px-2 font-mono">{item.product_code ?? '—'}</td>
                      <td className="py-1 px-2">{item.description ?? '—'}</td>
                      <td className="py-1 px-2 text-right">{item.quantity}</td>
                      <td className="py-1 px-2 text-right">{formatCurrency(item.unit_price, order.currency)}</td>
                      <td className="py-1 px-2 text-right font-medium">{formatCurrency(item.total, order.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
          <ActivityTimeline orderId={id} accountId={order.account_id} />
        </div>
      </div>
    </div>
  )
}
