import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/hooks/useTasks'
import { useTaskNotifications } from '@/hooks/useTaskNotifications'
import { CountryBadge } from '@/components/CountryBadge'
import { StageBadge } from '@/components/StageBadge'
import { formatCurrency, ALERT_SEVERITY_COLORS, cn } from '@/lib/utils'
import type { AutomationTask, TaskKind } from '@/lib/automations/rules'

const KIND_META: Record<TaskKind, { label: string; icon: string }> = {
  followup: { label: 'Follow-up', icon: '↩' },
  expiring: { label: 'Validade', icon: '⏳' },
  stalled: { label: 'Parada', icon: '🧊' },
}

function TaskRow({ task }: { task: AutomationTask }) {
  const navigate = useNavigate()
  const meta = KIND_META[task.kind]
  return (
    <div
      onClick={() => navigate(`/cotacoes/${task.quoteId}`)}
      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
    >
      <span className={cn('mt-1.5 text-sm shrink-0', ALERT_SEVERITY_COLORS[task.severity])}>●</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            {meta.icon} {meta.label}
          </span>
          <span className="font-medium text-sm">{task.accountName}</span>
          <CountryBadge iso2={task.countryIso2} />
          <span className="text-xs text-gray-400">{task.quoteNumber}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{task.detail}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(task.totalValue, task.currency)}</span>
        <StageBadge stage={task.stage} size="xs" />
      </div>
    </div>
  )
}

function Group({ title, tasks }: { title: string; tasks: AutomationTask[] }) {
  if (tasks.length === 0) return null
  return (
    <div className="mb-2">
      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title} <span className="font-normal normal-case">({tasks.length})</span>
      </div>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </div>
  )
}

export function TodayPage() {
  const { tasks, groups, isLoading } = useTasks()
  const { permission, enable } = useTaskNotifications(tasks)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-sm font-semibold">Hoje</h1>
          <p className="text-xs text-gray-500">
            {tasks.length > 0 ? `${tasks.length} ação(ões) sugerida(s) pelo pipeline` : 'Nada pendente'}
          </p>
        </div>
        {permission !== 'granted' && permission !== 'unsupported' && (
          <button onClick={enable} className="btn-secondary text-xs">
            🔔 Ativar avisos
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando…</div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <span className="text-3xl">✨</span>
            <p className="text-sm">Tudo em dia — nenhum follow-up, validade ou cotação parada pendente.</p>
          </div>
        ) : (
          <>
            <Group title="Urgentes" tasks={groups.urgentes} />
            <Group title="Atenção" tasks={groups.atencao} />
          </>
        )}
      </div>
    </div>
  )
}
