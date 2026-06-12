import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
}

/** Painel de risco — lê a mesma fila de ação que a página Hoje (v_action_queue). */
export function BrainPanel() {
  const { tasks, isLoading } = useTasks()
  const navigate = useNavigate()
  const top = tasks.slice(0, 8)

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-400 animate-pulse">Carregando alertas...</div>
    )
  }

  if (top.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 flex items-center gap-2">
        <span>✨</span>
        <span>Nenhuma ação pendente</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {top.map((task) => (
        <div
          key={task.id}
          className={cn(
            'card p-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors',
            task.severity === 'critical' && 'border-red-300 dark:border-red-800',
            task.severity === 'warning' && 'border-amber-300 dark:border-amber-800',
          )}
          onClick={() => navigate(`/cotacoes/${task.quoteId}`)}
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5">{SEVERITY_ICON[task.severity]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-tight">{task.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {task.accountName} · {task.quoteNumber}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{task.detail}</p>
            </div>
          </div>
        </div>
      ))}
      {tasks.length > top.length && (
        <button
          onClick={() => navigate('/hoje')}
          className="text-xs text-brand-600 dark:text-brand-400 hover:underline text-center py-1"
        >
          Ver todas ({tasks.length}) →
        </button>
      )}
    </div>
  )
}
