import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatDate, formatRelativeDate } from '@/lib/utils'
import { useDeleteActivity, useDeleteActivities } from '@/hooks/useActivities'

const KIND_LABELS: Record<string, string> = {
  call: '📞 Ligação', email_sent: '📤 Email enviado', email_received: '📥 Email recebido',
  meeting: '🤝 Reunião', note: '📝 Nota', task: '✓ Tarefa', system_event: '⚙️ Sistema',
}

export function ActivitiesPage() {
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const deleteActivity = useDeleteActivity()
  const deleteActivities = useDeleteActivities()

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`*, user:users(name), account:accounts(legal_name), quote:quotes(quote_number)`)
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })

  const allSelected = activities.length > 0 && selectedIds.size === activities.length
  const someSelected = selectedIds.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(activities.map((a: { id: string }) => a.id)))
    }
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function removeOne(id: string) {
    if (!confirm('Excluir esta atividade?')) return
    await deleteActivity.mutateAsync(id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function removeSelected() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const msg = ids.length === 1
      ? 'Excluir esta atividade?'
      : `Excluir ${ids.length} atividades? Esta ação não pode ser desfeita.`
    if (!confirm(msg)) return
    await deleteActivities.mutateAsync(ids)
    setSelectedIds(new Set())
  }

  const deleting = deleteActivity.isPending || deleteActivities.isPending

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Atividades Recentes</h1>
        {someSelected && (
          <button
            onClick={removeSelected}
            disabled={deleting}
            className="btn-danger text-xs shrink-0"
          >
            Excluir {selectedIds.size} selecionada(s)
          </button>
        )}
      </div>

      {!isLoading && activities.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
              onChange={toggleAll}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Selecionar todos
          </label>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Nenhuma atividade registrada</div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {activities.map((a: any) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 ${selectedIds.has(a.id) ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.id)}
                  onChange={() => toggleOne(a.id)}
                  className="mt-1 rounded border-gray-300 dark:border-gray-600 shrink-0"
                  aria-label="Selecionar atividade"
                />
                <span className="text-sm pt-0.5 shrink-0">{KIND_LABELS[a.kind]?.split(' ')[0]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.title ?? KIND_LABELS[a.kind]?.split(' ').slice(1).join(' ')}</span>
                    {a.account && (
                      <button onClick={() => navigate(`/contas/${a.account_id}`)} className="text-xs text-gray-500 hover:underline">
                        {a.account.legal_name}
                      </button>
                    )}
                    {a.quote && (
                      <button onClick={() => navigate(`/cotacoes/${a.quote_id}`)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                        {a.quote.quote_number}
                      </button>
                    )}
                  </div>
                  {a.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{a.user?.name}</span>
                    <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-xs text-gray-400" title={formatDate(a.occurred_at)}>{formatRelativeDate(a.occurred_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeOne(a.id)}
                  disabled={deleting}
                  className="text-xs text-gray-300 hover:text-red-600 shrink-0 pt-0.5"
                  title="Excluir"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
