import { useState } from 'react'
import { useCountryMetrics, useMonthlyKpis } from '@/hooks/useDashboard'
import { WorldMap } from '@/components/WorldMap'
import { BrainPanel } from '@/components/BrainPanel'
import { KpiStrip } from '@/components/KpiStrip'
import { CountryBadge } from '@/components/CountryBadge'
import { formatCurrency } from '@/lib/utils'
import type { CountryMetrics } from '@crm-plp/shared'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

type Metric = 'quoted' | 'orders' | 'hit_rate'

const METRIC_LABELS: Record<Metric, string> = {
  quoted: 'Cotado',
  orders: 'Pedidos',
  hit_rate: 'Hit Rate',
}

export function DashboardPage() {
  const [metric, setMetric] = useState<Metric>('quoted')
  const [selected, setSelected] = useState<CountryMetrics | null>(null)
  const { data: countryMetrics = [] } = useCountryMetrics()
  const { data: monthlyKpis = [] } = useMonthlyKpis()

  const chartData = monthlyKpis.map(m => ({
    month: m.month.slice(5),
    'Recebidas': m.quotes_received,
    'Enviadas': m.quotes_sent,
    'Pedidos': m.orders_received,
  }))

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <KpiStrip />

      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <span className="text-sm font-semibold">Dashboard Mundial</span>
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs ml-auto">
            {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 transition-colors ${
                  metric === m
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400'
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 p-4">
            <WorldMap
              data={countryMetrics}
              metric={metric}
              onCountryClick={setSelected}
            />
          </div>

          <div className="w-72 shrink-0 border-l border-gray-200 dark:border-gray-800 flex flex-col">
            {selected ? (
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{selected.country}</h3>
                    <CountryBadge iso2={selected.country_iso2} />
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cotado</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(selected.quoted_value_usd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Pedidos</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(selected.orders_value_usd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Hit rate</dt>
                    <dd className="font-medium">{(selected.hit_rate * 100).toFixed(0)}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cotações</dt>
                    <dd className="font-medium">{selected.quote_count}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400">
                Clique em um país no mapa para ver detalhes
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase">Radar de risco</p>
              <BrainPanel />
            </div>
          </div>
        </div>

        <div className="h-56 px-5 pb-4 border-t border-gray-200 dark:border-gray-800 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Recebidas" stroke="#f59e0b" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="Enviadas" stroke="#6366f1" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="Pedidos" stroke="#10b981" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
