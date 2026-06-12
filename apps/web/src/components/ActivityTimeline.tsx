import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useActivities, useCreateActivity, useUpdateActivity, useDeleteActivity } from '@/hooks/useActivities'
import { useConfirm } from '@/components/ConfirmProvider'
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
  const updateActivity = useUpdateActivity()
  const deleteActivity = useDeleteActivity()
  const confirmDialog = useConfirm()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ kind: 'note' as ActivityKind, title: '', body: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (editId) {
      await updateActivity.mutateAsync({ id: editId, kind: form.kind, title: form.title || null, body: form.body || null })
    } else {
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
    }
    setForm({ kind: 'note', title: '', body: '' })
    setEditId(null)
    setOpen(false)
  }

  function startEdit(act: { id: string; kind: ActivityKind; title: string | null; body: string | null }) {
    setForm({ kind: act.kind, title: act.title ?? '', body: act.body ?? '' })
    setEditId(act.id)
    setOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Atividades</h3>
        <button
          onClick={() => { setEditId(null); setForm({ kind: 'note', title: '', body: '' }); setOpen(o => !o) }}
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
            <button type="submit" disabled={createActivity.isPending || updateActivity.isPending} className="btn-primary text-xs">
              {editId ? 'Salvar edição' : 'Salvar'}
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
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-400" title={formatDate(act.occurred_at)}>{formatRelativeDate(act.occurred_at)}</span>
                  <button onClick={() => startEdit(act)} className="p-0.5 text-gray-300 hover:text-gray-700 dark:hover:text-gray-200" title="Editar"><Pencil size={12} /></button>
                  <button
                    onClick={async () => {
                      if (await confirmDialog({ title: 'Excluir esta atividade?' })) deleteActivity.mutate(act.id)
                    }}
                    className="p-0.5 text-gray-300 hover:text-red-600"
                    title="Excluir"
                  ><Trash2 size={12} /></button>
                </div>
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
