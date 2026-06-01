import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAccounts, useAccount, useCreateAccount } from '@/hooks/useAccounts'
import { CountryBadge } from '@/components/CountryBadge'
import { StageBadge } from '@/components/StageBadge'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Account } from '@crm-plp/shared'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  direct_customer: 'Cliente Direto',
  subsidiary: 'Subsidiária',
  distributor: 'Distribuidor',
  representative: 'Representante',
  partner: 'Parceiro',
}

export function AccountsListPage() {
  const navigate = useNavigate()
  const { data: accounts = [], isLoading } = useAccounts()
  const create = useCreateAccount()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    legal_name: '', country: '', country_iso2: '',
    account_type: 'direct_customer' as Account['account_type'],
    currency_default: 'USD', segment: '', notes: '',
    parent_account_id: null as string | null,
  })

  const filtered = accounts.filter(a =>
    !search || a.legal_name.toLowerCase().includes(search.toLowerCase()) ||
    a.country.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const result = await create.mutateAsync(form)
    setShowForm(false)
    navigate(`/contas/${result.id}`)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Contas ({accounts.length})</h1>
        <div className="flex gap-2">
          <input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-48 text-xs"
          />
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs">+ Nova</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-5 shadow-xl animate-fade-in">
            <h2 className="font-semibold mb-4">Nova Conta</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Razão Social *</label>
                  <input required value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">País *</label>
                  <input required value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="input" placeholder="Argentina" />
                </div>
                <div>
                  <label className="label">ISO2</label>
                  <input maxLength={2} value={form.country_iso2} onChange={e => setForm(f => ({ ...f, country_iso2: e.target.value.toUpperCase() }))} className="input" placeholder="AR" />
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value as any }))} className="input">
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Moeda padrão</label>
                  <select value={form.currency_default} onChange={e => setForm(f => ({ ...f, currency_default: e.target.value }))} className="input">
                    {['USD','EUR','ARS','CLP','COP','PEN','PYG'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Segmento</label>
                  <input value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={create.isPending} className="btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
              <tr>
                {['Conta','País','Tipo','Moeda','Segmento'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} onClick={() => navigate(`/contas/${a.id}`)} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer">
                  <td className="px-4 py-2.5 font-medium">{a.legal_name}</td>
                  <td className="px-4 py-2.5"><CountryBadge iso2={a.country_iso2} country={a.country} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ACCOUNT_TYPE_LABELS[a.account_type]}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{a.currency_default}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{a.segment ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: account, isLoading } = useAccount(id!)
  const [tab, setTab] = useState<'quotes' | 'orders' | 'activity'>('quotes')

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400">Carregando...</div>
  if (!account) return <div className="flex items-center justify-center h-full text-gray-400">Conta não encontrada</div>

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => navigate('/contas')} className="text-xs text-gray-400 hover:text-gray-700 mb-1">← Contas</button>
            <h1 className="text-lg font-semibold">{account.legal_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <CountryBadge iso2={account.country_iso2} country={account.country} />
              <span className="text-xs text-gray-500">{ACCOUNT_TYPE_LABELS[account.account_type]}</span>
              {account.segment && <span className="text-xs text-gray-400">{account.segment}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Contacts */}
      {account.contacts && account.contacts.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">CONTATOS</h3>
          <div className="flex gap-4 flex-wrap">
            {account.contacts.map((c: any) => (
              <div key={c.id} className="text-sm">
                <span className="font-medium">{c.name}</span>
                {c.role && <span className="text-gray-500 text-xs ml-1">· {c.role}</span>}
                {c.email && <span className="text-gray-400 text-xs ml-2">{c.email}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-800 px-6">
        {(['quotes','orders','activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {{ quotes: `Cotações (${account.quotes?.length ?? 0})`, orders: `Pedidos (${account.orders?.length ?? 0})`, activity: 'Atividades' }[t]}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6">
        {tab === 'quotes' && (
          <div className="flex flex-col gap-2">
            {(account.quotes ?? []).map((q: any) => (
              <div key={q.id} onClick={() => navigate(`/cotacoes/${q.id}`)} className="card p-3 cursor-pointer hover:border-brand-400 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{q.quote_number}</p>
                  <p className="text-xs text-gray-500">{formatDate(q.received_at)}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(q.total_value, q.currency)}</span>
                <StageBadge stage={q.stage} size="xs" />
              </div>
            ))}
            {(!account.quotes || account.quotes.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">Nenhuma cotação</p>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="flex flex-col gap-2">
            {(account.orders ?? []).map((o: any) => (
              <div key={o.id} onClick={() => navigate(`/pedidos/${o.id}`)} className="card p-3 cursor-pointer hover:border-brand-400 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{o.po_number ?? o.internal_number ?? o.id.slice(0,8)}</p>
                  <p className="text-xs text-gray-500">{formatDate(o.received_at)}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(o.total_value, o.currency)}</span>
                <span className="text-xs text-gray-500">{o.status}</span>
              </div>
            ))}
            {(!account.orders || account.orders.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum pedido</p>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <ActivityTimeline accountId={id} />
        )}
      </div>
    </div>
  )
}
