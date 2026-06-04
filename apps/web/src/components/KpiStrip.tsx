import { useCurrentMonthKpis } from '@/hooks/useDashboard'
import { usePipelineQuotes } from '@/hooks/useQuotes'
import { useFxRates } from '@/hooks/useFxRates'
import { formatCurrency } from '@/lib/utils'

function delta(curr: number, prev: number) {
  if (!prev) return null
  const pct = ((curr - prev) / prev) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

function KpiCell({ label, value, prev }: { label: string; value: number; prev?: number }) {
  const d = prev != null ? delta(value, prev) : null
  const positive = d ? !d.startsWith('-') : null
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      {d && (
        <span className={`text-xs ${positive ? 'text-green-600' : 'text-red-500'}`}>{d} vs mês ant.</span>
      )}
    </div>
  )
}

export function KpiStrip() {
  const { data } = useCurrentMonthKpis()
  const c = data?.current
  const p = data?.previous
  const { data: pipeline = [] } = usePipelineQuotes()
  const { toBRL } = useFxRates()
  const pipelineBrl = pipeline.reduce(
    (s, q) => s + (q.total_value_brl ?? toBRL(q.total_value, q.currency, q.fx_to_brl) ?? 0),
    0,
  )

  return (
    <div className="flex items-center gap-8 px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <KpiCell
        label="Cotações Recebidas"
        value={c?.quotes_received ?? 0}
        prev={p?.quotes_received}
      />
      <div className="w-px h-8 bg-gray-200 dark:bg-gray-800" />
      <KpiCell
        label="Cotações Enviadas"
        value={c?.quotes_sent ?? 0}
        prev={p?.quotes_sent}
      />
      <div className="w-px h-8 bg-gray-200 dark:bg-gray-800" />
      <KpiCell
        label="Pedidos Recebidos"
        value={c?.orders_received ?? 0}
        prev={p?.orders_received}
      />
      <div className="w-px h-8 bg-gray-200 dark:bg-gray-800" />
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 dark:text-gray-400">Valor Cotado (pipeline)</span>
        <span className="text-xl font-semibold tabular-nums">
          {formatCurrency(pipelineBrl, 'BRL')}
        </span>
      </div>
    </div>
  )
}
