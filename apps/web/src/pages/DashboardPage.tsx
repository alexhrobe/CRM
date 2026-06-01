import { useState } from 'react'
import { useCountryMetrics, useMonthlyKpis } from '@/hooks/useDashboard'
import { WorldMap } from '@/components/WorldMap'
import { BrainPanel } from '@/components/BrainPanel'
import { KpiStrip } from '@/components/KpiStrip'
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
  const { data: countryMetrics = [] } = useCountryMetrics()
  const { data: monthlyKpis = [] } = useMonthlyKpis()

  function handleCountryClick(c: CountryMetrics) {
    const label = METRIC_LABELS[metric]
    const val = metric === 'quoted' ? formatCurrency(c.quoted_value_usd)
      : metric === 'orders' ? formatCurrency(c.orders_value_usd)
      : `${(c.hit_rate * 100).toFixed(0)}%`
    alert(`${c.country} — ${label}: ${val}\nHit rate: ${(c.hit_rate * 100).toFixed(0)}%`)
  }

  const chartData = monthlyKpis.map(m => ({
    month: m.month.slice(5), // MM
    'Recebidas': m.quotes_received,
    'Enviadas': m.quotes_sent,
    'Pedidos': m.orders_received,
  }))

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <KpiStrip />

      <div className="flex-1 flex flex-col">
        {/* Metric toggle */}
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

        <div className="flex gap-0 flex-1">
          {/* Map + Chart column */}
          <div className="flex-1 flex flex-col min-w-0 p-5 gap-6">
            <div className="card overflow-hidden">
              <WorldMap
                data={countryMetrics}
                metric={metric}
                onCountryClick={handleCountryClick}
              />
            </div>

            {/* Time series chart */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-4">Últimos 12 meses</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-prose-hr, #e5e7eb)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Recebidas" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Enviadas" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Pedidos" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Brain panel */}
          <div className="w-72 shrink-0 border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span>✨</span> Cérebro
              </h3>
            </div>
            <BrainPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
