import { useActiveAlerts } from '@/hooks/useAlerts'
import { useDismissAlert } from '@/hooks/useAlerts'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
}

export function BrainPanel() {
  const { data: alerts = [], isLoading } = useActiveAlerts()
  const dismiss = useDismissAlert()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-400 animate-pulse">Carregando alertas...</div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 flex items-center gap-2">
        <span>✨</span>
        <span>Nenhum alerta ativo</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={cn(
            'card p-3 text-sm group',
            alert.severity === 'critical' && 'border-red-300 dark:border-red-800',
            alert.severity === 'warning' && 'border-amber-300 dark:border-amber-800',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="shrink-0 mt-0.5">{SEVERITY_ICON[alert.severity]}</span>
              <div className="min-w-0">
                <p className="font-medium leading-tight truncate">{alert.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{alert.body}</p>
                {alert.suggested_action && (
                  <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">{alert.suggested_action}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => dismiss.mutate(alert.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
              title="Dispensar"
            >
              ✕
            </button>
          </div>
          {alert.quote_id && (
            <button
              onClick={() => navigate(`/cotacoes/${alert.quote_id}`)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 underline"
            >
              Ver cotação →
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
