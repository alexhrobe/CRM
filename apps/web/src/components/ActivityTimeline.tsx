import { useState } from 'react'
import { useActivities, useCreateActivity } from '@/hooks/useActivities'
import { useAuth } from '@/lib/auth'
import { formatRelativeDate, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ActivityKind } from '@crm-plp/shared'

const KIND_LABELS: Record<string, string> = {
  call: '📞 Ligação',
  email_sent: '📤 Email enviado',
  email_received: '📥 Email recebido',
  meeting: '🤝 Reunião',
  note: '📝 Nota',
  task: '✓ Tarefa',
  system_event: '⚙️ Sistema',
}

interface Props {
  quoteId?: string
  accountId?: string
  orderId?: string
}

export function ActivityTimeline({ quoteId, accountId, orderId }: Props) {
  const { data: activities = [], isLoading } = useActivities({ quoteId, accountId, orderId })
  const { user } = useAuth()
  const createActivity = useCreateActivity()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ kind: 'note' as ActivityKind, title: '', body: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    await createActivity.mutateAsync({
      ...form,
      user_id: user.id,
      account_id: accountId,
      quote_id: quoteId ?? null,
      order_id: orderId ?? null,
      contact_id: null,
      due_at: null,
      occurred_at: new Date().toISOString(),
    })
    setForm({ kind: 'note', title: '', body: '' })
    setOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Atividades</h3>
        <button
          onClick={() => setOpen(o => !o)}
          className="btn-secondary text-xs"
        >
          + Nova
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="card p-3 mb-4 flex flex-col gap-2 animate-fade-in">
          <div className="flex gap-2">
            <select
              value={form.kind}
              onChange={e => setForm(f => ({ ...f, kind: e.target.value as ActivityKind }))}
              className="input flex-1"
            >
              {Object.entries(KIND_LABELS).filter(([k]) => k !== 'system_event').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              placeholder="Título (opcional)"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input flex-1"
            />
          </div>
          <textarea
            placeholder="Detalhes..."
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={3}
            className="input resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancelar</button>
            <button type="submit" disabled={createActivity.isPending} className="btn-primary text-xs">
              Salvar
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-sm text-gray-400 py-4">Carregando...</p>}

      <div className="flex flex-col">
        {activities.map((act: any, i: number) => (
          <div key={act.id} className={cn('flex gap-3 pb-4', i < activities.length - 1 && 'border-l-2 border-gray-100 dark:border-gray-800 ml-2')}>
            <div className="flex flex-col items-center shrink-0 -ml-2.5">
              <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs">
                {KIND_LABELS[act.kind]?.charAt(0) ?? '•'}
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{KIND_LABELS[act.kind] ?? act.kind}</span>
                <span className="text-xs text-gray-400 shrink-0" title={formatDate(act.occurred_at)}>
                  {formatRelativeDate(act.occurred_at)}
                </span>
              </div>
              {act.title && <p className="text-sm mt-0.5">{act.title}</p>}
              {act.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-line">{act.body}</p>}
              {act.user && <p className="text-xs text-gray-400 mt-1">por {act.user.name}</p>}
            </div>
          </div>
        ))}

        {activities.length === 0 && !isLoading && (
          <p className="text-sm text-gray-400 py-4 text-center">Nenhuma atividade registrada</p>
        )}
      </div>
    </div>
  )
}
