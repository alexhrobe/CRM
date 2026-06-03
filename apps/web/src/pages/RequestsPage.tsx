import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { QuoteRequestWithAccount, RequestStatus } from '@crm-plp/shared'
import { useQuoteRequests, useCreateQuoteRequest, useUpdateQuoteRequest } from '@/hooks/useQuoteRequests'
import { useAccounts } from '@/hooks/useAccounts'
import { QuoteForm } from '@/components/QuoteForm'
import { CountryBadge } from '@/components/CountryBadge'
import { REQUEST_STATUS_COLORS, REQUEST_STATUS_LABELS, waitingLabel } from '@/lib/requests/format'
import { formatDate, cn } from '@/lib/utils'

type Filter = RequestStatus | 'all'

export function RequestsPage() {
  const [filter, setFilter] = useState<Filter>('new')
  const [showNew, setShowNew] = useState(false)
  const [converting, setConverting] = useState<QuoteRequestWithAccount | null>(null)
  const { data: requests = [], isLoading } = useQuoteRequests(filter)
  const update = useUpdateQuoteRequest()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-sm font-semibold">Solicitações de orçamento</h1>
          <p className="text-xs text-gray-500">Fila por ordem de chegada</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
            {(['new', 'quoting', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1 transition-colors',
                  filter === f
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400',
                )}
              >
                {{ new: 'Novas', quoting: 'Em cotação', all: 'Todas' }[f]}
              </button>
            ))}
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs">
            + Nova solicitação
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando…</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <span className="text-3xl">📨</span>
            <p className="text-sm">Nenhuma solicitação na fila.</p>
          </div>
        ) : (
          requests.map((r, i) => (
            <div
              key={r.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800"
            >
              <span className="mt-0.5 w-6 text-center text-xs font-mono text-gray-400 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{r.from_name ?? '—'}</span>
                  {r.account?.country_iso2 && <CountryBadge iso2={r.account.country_iso2} country={r.account.country} />}
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', REQUEST_STATUS_COLORS[r.status])}>
                    {REQUEST_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <p className="text-sm mt-0.5 truncate">{r.subject ?? '(sem assunto)'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(r.received_at)} · {waitingLabel(r.received_at)}
                  {r.from_email ? ` · ${r.from_email}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {r.status !== 'quoted' && r.status !== 'discarded' && (
                  <button onClick={() => setConverting(r)} className="btn-primary text-xs">
                    Converter em cotação
                  </button>
                )}
                {r.status === 'quoted' && r.quote_id && (
                  <button onClick={() => navigate(`/cotacoes/${r.quote_id}`)} className="btn-secondary text-xs">
                    Ver cotação →
                  </button>
                )}
                {r.status !== 'discarded' && r.status !== 'quoted' && (
                  <button
                    onClick={() => update.mutate({ id: r.id, status: 'discarded' })}
                    className="btn-ghost text-xs text-gray-400"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}

      {converting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">Converter em cotação</h2>
              <button onClick={() => setConverting(null)} className="btn-ghost text-sm">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              De: {converting.from_name} — {converting.subject}
            </p>
            <QuoteForm
              initial={{ account_id: converting.account_id ?? undefined }}
              onSuccess={(quoteId) => {
                update.mutate({ id: converting.id, status: 'quoted', quote_id: quoteId })
                setConverting(null)
                navigate(`/cotacoes/${quoteId}`)
              }}
              onCancel={() => setConverting(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useAccounts()
  const create = useCreateQuoteRequest()
  const [form, setForm] = useState({
    from_name: '',
    from_email: '',
    subject: '',
    body: '',
    account_id: '',
    received_at: new Date().toISOString().slice(0, 16),
  })
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit() {
    if (!form.from_name.trim()) return
    await create.mutateAsync({
      from_name: form.from_name.trim(),
      from_email: form.from_email.trim() || null,
      subject: form.subject.trim() || null,
      body: form.body.trim() || null,
      account_id: form.account_id || null,
      received_at: new Date(form.received_at).toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Nova solicitação</h2>
          <button onClick={onClose} className="btn-ghost text-sm">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cliente / remetente *</label>
              <input value={form.from_name} onChange={set('from_name')} className="input" placeholder="Ex.: Compras YPF" />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input value={form.from_email} onChange={set('from_email')} className="input" placeholder="compras@cliente.com" />
            </div>
          </div>
          <div>
            <label className="label">Conta (opcional)</label>
            <select value={form.account_id} onChange={set('account_id')} className="input">
              <option value="">— não vincular —</option>
              {accounts.map((a: { id: string; legal_name: string }) => (
                <option key={a.id} value={a.id}>{a.legal_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assunto</label>
            <input value={form.subject} onChange={set('subject')} className="input" placeholder="Solicitud cotización…" />
          </div>
          <div>
            <label className="label">Texto do e-mail</label>
            <textarea value={form.body} onChange={set('body')} className="input resize-none" rows={4} placeholder="Cole aqui o conteúdo do pedido…" />
          </div>
          <div>
            <label className="label">Recebido em</label>
            <input type="datetime-local" value={form.received_at} onChange={set('received_at')} className="input" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn-ghost">Cancelar</button>
            <button onClick={submit} disabled={!form.from_name.trim() || create.isPending} className="btn-primary">
              {create.isPending ? 'Salvando…' : 'Adicionar à fila'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
