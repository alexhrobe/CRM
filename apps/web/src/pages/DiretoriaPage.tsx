import { useNavigate } from 'react-router-dom'
import { useExecutiveSummary, usePipelineByAccount, useRecentJobRuns } from '@/hooks/useExecutive'
import { useTasks } from '@/hooks/useTasks'
import { CountryBadge } from '@/components/CountryBadge'
import { formatCurrency, cn } from '@/lib/utils'

function KpiCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string
  value: string
  sub?: string
  alert?: boolean
}) {
  return (
    <div className={cn('card p-4', alert && 'border-red-300 dark:border-red-800')}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export function DiretoriaPage() {
  const navigate = useNavigate()
  const { data: summary, isLoading: loadingSummary } = useExecutiveSummary()
  const { data: byAccount = [] } = usePipelineByAccount()
  const { data: jobRuns = [] } = useRecentJobRuns(3)
  const { tasks, groups } = useTasks()

  const lastJob = jobRuns[0]
  const fxStale = summary?.last_fx_usd_date
    ? new Date(summary.last_fx_usd_date) < new Date(Date.now() - 3 * 86400000)
    : true

  if (loadingSummary) {
    return (
      <div className="flex items-center justify-center flex-1 text-gray-400">
        Carregando cockpit…
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <h1 className="text-lg font-bold">Centro de Comando</h1>
        <p className="text-sm text-gray-500">
          Pipeline, risco e saúde operacional — atualizado ao vivo
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Pipeline (BRL)"
            value={formatCurrency(summary?.pipeline_brl ?? 0, 'BRL')}
            sub={`${summary?.open_quotes ?? 0} cotações abertas`}
          />
          <KpiCard
            label="Pipeline ponderado"
            value={formatCurrency(summary?.pipeline_weighted_brl ?? 0, 'BRL')}
            sub="Valor × prob. (efetiva por estágio)"
          />
          <KpiCard
            label="Em risco crítico"
            value={formatCurrency(summary?.critical_value_brl ?? 0, 'BRL')}
            sub={`${summary?.critical_actions ?? 0} ação(ões) urgentes`}
            alert={(summary?.critical_actions ?? 0) > 0}
          />
          <KpiCard
            label="Concentração"
            value={`${summary?.top_account_concentration_pct ?? 0}%`}
            sub={summary?.top_account_name ?? '—'}
            alert={(summary?.top_account_concentration_pct ?? 0) > 35}
          />
        </div>

        {/* Status operacional */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Status do sistema</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Última manutenção automática</span>
              <p className="font-medium mt-0.5">
                {lastJob
                  ? new Date(lastJob.started_at).toLocaleString('pt-BR')
                  : 'Nenhuma execução registrada'}
                {lastJob && (
                  <span className={cn('ml-2 text-xs', lastJob.success ? 'text-green-600' : 'text-red-600')}>
                    {lastJob.success ? '✓ OK' : '✗ Falhou'}
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Câmbio USD (PTAX)</span>
              <p className={cn('font-medium mt-0.5', fxStale && 'text-amber-600')}>
                {summary?.last_fx_usd_date ?? '—'}
                {fxStale && ' · desatualizado'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Ações pendentes</span>
              <p className="font-medium mt-0.5">
                {summary?.pending_actions ?? 0} total · {groups.urgentes.length} urgentes
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top riscos */}
          <div className="card">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-sm font-semibold">Top riscos</h2>
              <button onClick={() => navigate('/hoje')} className="text-xs text-brand-600 hover:underline">
                Ver fila completa →
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Nenhuma ação pendente.</p>
            ) : (
              tasks.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/cotacoes/${t.quoteId}`)}
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.accountName}</p>
                    <p className="text-xs text-gray-500">{t.title} · {t.detail}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(t.sortValueBrl, 'BRL')}
                    </p>
                    <span className={cn('text-xs', t.severity === 'critical' ? 'text-red-600' : 'text-amber-600')}>
                      {t.severity === 'critical' ? 'Crítico' : 'Atenção'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Top contas */}
          <div className="card">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold">Pipeline por conta</h2>
            </div>
            {byAccount.slice(0, 8).map((a) => (
              <div
                key={a.account_id}
                onClick={() => navigate(`/contas/${a.account_id}`)}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{a.account_name}</span>
                  <CountryBadge iso2={a.country_iso2} />
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(a.pipeline_brl ?? 0, 'BRL')}
                  </p>
                  <p className="text-xs text-gray-400">
                    pond. {formatCurrency(a.pipeline_weighted_brl ?? 0, 'BRL')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
