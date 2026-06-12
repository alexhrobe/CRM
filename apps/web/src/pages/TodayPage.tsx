import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarPlus, CheckCircle2, Hourglass, Reply, Snowflake, Sparkles, type LucideIcon } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useTaskNotifications } from '@/hooks/useTaskNotifications'
import { useCreateActivity } from '@/hooks/useActivities'
import { useUpdateQuote } from '@/hooks/useQuotes'
import { useAuth } from '@/lib/auth'
import { CountryBadge } from '@/components/CountryBadge'
import { ListSkeleton } from '@/components/Skeleton'
import { StageBadge } from '@/components/StageBadge'
import { formatCurrency, ALERT_SEVERITY_COLORS, cn } from '@/lib/utils'
import type { AutomationTask, TaskKind } from '@/lib/automations/rules'

const KIND_META: Record<TaskKind, { label: string; icon: LucideIcon }> = {
  followup: { label: 'Follow-up', icon: Reply },
  expiring: { label: 'Validade', icon: Hourglass },
  stalled: { label: 'Parada', icon: Snowflake },
}

function TaskRow({ task }: { task: AutomationTask }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const createActivity = useCreateActivity()
  const updateQuote = useUpdateQuote()
  const meta = KIND_META[task.kind]
  const busy = createActivity.isPending || updateQuote.isPending

  // Registra o contato direto da fila — a tarefa some sozinha (last_activity_at)
  function markContacted(e: MouseEvent) {
    e.stopPropagation()
    if (!user) return
    createActivity.mutate({
      kind: task.kind === 'followup' ? 'email_sent' : 'call',
      title: task.kind === 'followup' ? 'Follow-up enviado' : 'Contato para destravar',
      body: null,
      quote_id: task.quoteId,
      order_id: null,
      contact_id: null,
      due_at: null,
      occurred_at: new Date().toISOString(),
      user_id: user.id,
    })
  }

  // Estende a validade em 30 dias a partir de hoje
  function extendValidity(e: MouseEvent) {
    e.stopPropagation()
    const d = new Date(Date.now() + 30 * 86_400_000)
    updateQuote.mutate({ id: task.quoteId, expected_close_at: d.toISOString().slice(0, 10) })
  }

  return (
    <div
      onClick={() => navigate(`/cotacoes/${task.quoteId}`)}
      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 group"
    >
      <span className={cn('mt-1.5 text-sm shrink-0', ALERT_SEVERITY_COLORS[task.severity])}>●</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            <meta.icon size={12} /> {meta.label}
          </span>
          <span className="font-medium text-sm">{task.accountName}</span>
          <CountryBadge iso2={task.countryIso2} />
          <span className="text-xs text-gray-400">{task.quoteNumber}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{task.detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(task.kind === 'followup' || task.kind === 'stalled') && (
          <button
            onClick={markContacted}
            disabled={busy}
            title="Registra a atividade e resolve a tarefa"
            className="btn-secondary text-xs opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1"
          >
            <CheckCircle2 size={13} /> Contato feito
          </button>
        )}
        {task.kind === 'expiring' && (
          <button
            onClick={extendValidity}
            disabled={busy}
            title="Nova validade: hoje + 30 dias"
            className="btn-secondary text-xs opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1"
          >
            <CalendarPlus size={13} /> +30 dias
          </button>
        )}
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(task.totalValue, task.currency)}</span>
          <StageBadge stage={task.stage} size="xs" />
        </div>
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
          <button onClick={enable} className="btn-secondary text-xs inline-flex items-center gap-1">
            <Bell size={13} /> Ativar avisos
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Sparkles size={28} />
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
