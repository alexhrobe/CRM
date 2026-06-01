import { useNavigate } from 'react-router-dom'
import { useOrders } from '@/hooks/useOrders'
import { CountryBadge } from '@/components/CountryBadge'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_production: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Recebido', in_production: 'Em Produção',
  shipped: 'Embarcado', delivered: 'Entregue', canceled: 'Cancelado',
}

export function OrdersListPage() {
  const navigate = useNavigate()
  const { data: orders = [], isLoading } = useOrders()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Pedidos ({orders.length})</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
              <tr>
                {['Recebido','PO','Cliente','País','Valor','Status','Entrega','Cotação'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} onClick={() => navigate(`/pedidos/${o.id}`)} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer">
                  <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(o.received_at)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{o.po_number ?? o.internal_number ?? '—'}</td>
                  <td className="px-4 py-2.5 font-medium">{o.account?.legal_name}</td>
                  <td className="px-4 py-2.5"><CountryBadge iso2={o.account?.country_iso2} country={o.account?.country} /></td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">{formatCurrency(o.total_value, o.currency)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(o.promised_delivery_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{o.quote?.quote_number ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
