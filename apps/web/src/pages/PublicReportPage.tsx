import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { WorldMap } from '@/components/WorldMap'
import type { CountryMetrics, ReportKpis } from '@crm-plp/shared'

export function PublicReportPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: report, isLoading } = useQuery({
    queryKey: ['public-report', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select(`*, snapshots:report_snapshots(*)`)
        .eq('slug', slug!)
        .single()
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-950 text-gray-400">
        Carregando relatório...
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Relatório não encontrado</h1>
          <p className="text-gray-500">O link pode estar inválido ou o relatório foi removido.</p>
        </div>
      </div>
    )
  }

  const kpis = report.snapshots?.find((s) => s.metric_key === 'kpis')?.payload as
    | ReportKpis
    | undefined
  const byCountry = (report.snapshots?.find((s) => s.metric_key === 'by_country')?.payload ??
    {}) as Record<string, any>
  const topWon = (report.snapshots?.find((s) => s.metric_key === 'top_quotes_won')?.payload ??
    []) as any[]

  // Transform by_country into CountryMetrics shape for WorldMap
  const countryMetrics: CountryMetrics[] = Object.entries(byCountry).map(([iso2, d]: [string, any]) => ({
    country: d.country ?? iso2,
    country_iso2: iso2,
    quoted_value_usd: d.quoted ?? 0,
    orders_value_usd: d.orders ?? 0,
    hit_rate: d.hit_rate ?? 0,
    quote_count: d.quote_count ?? 0,
    order_count: d.order_count ?? 0,
  }))

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen text-gray-900 dark:text-gray-100 print:text-black print:bg-white">
      {/* Print toolbar */}
      <div className="no-print flex items-center justify-between px-8 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-10">
        <span className="text-sm font-semibold text-gray-500">PLP Brasil · Relatório Mensal</span>
        <button
          onClick={() => window.print()}
          className="btn-secondary text-xs"
        >
          🖨️ Exportar PDF
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Title */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">PLP Brasil Export — Relatório Executivo</p>
          <h1 className="text-3xl font-bold">{report.title}</h1>
          <p className="text-gray-500 mt-1">Período: {report.period}</p>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-3 gap-6 mb-10 p-6 border border-gray-200 dark:border-gray-800 rounded-xl">
            {[
              { label: 'Cotações Recebidas', value: kpis.quotes_received },
              { label: 'Cotações Enviadas', value: kpis.quotes_sent },
              { label: 'Pedidos Recebidos', value: kpis.orders_received },
            ].map(k => (
              <div key={k.label}>
                <p className="text-sm text-gray-500">{k.label}</p>
                <p className="text-4xl font-bold mt-1">{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* World map */}
        {countryMetrics.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Distribuição Geográfica</h2>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <WorldMap data={countryMetrics} metric="quoted" />
            </div>
          </div>
        )}

        {/* Narrative */}
        {report.narrative && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Análise Executiva</h2>
            <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line text-base">
              {report.narrative}
            </div>
          </div>
        )}

        {/* Top won */}
        {topWon.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Principais Pedidos Ganhos</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-2">Cliente</th>
                  <th className="text-left py-2">Produto</th>
                  <th className="text-right py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {topWon.map((q: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2">{q.account_name}</td>
                    <td className="py-2 text-gray-500">{q.product_group ?? '—'}</td>
                    <td className="py-2 text-right font-medium">{q.total_value ? `${q.currency} ${q.total_value.toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-16 pt-6 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400 text-center">
          PLP Brasil Exportação · Documento gerado automaticamente · Confidencial
        </div>
      </div>
    </div>
  )
}
