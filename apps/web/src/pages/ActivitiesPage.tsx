import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatDate, formatRelativeDate } from '@/lib/utils'

const KIND_LABELS: Record<string, string> = {
  call: '📞 Ligação', email_sent: '📤 Email enviado', email_received: '📥 Email recebido',
  meeting: '🤝 Reunião', note: '📝 Nota', task: '✓ Tarefa', system_event: '⚙️ Sistema',
}

export function ActivitiesPage() {
  const navigate = useNavigate()
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Atividades Recentes</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {activities.map((a: any) => (
              <div key={a.id} className="flex items-start gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-900">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
