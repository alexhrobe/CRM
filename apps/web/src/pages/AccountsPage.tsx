import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { ListSkeleton } from '@/components/Skeleton'
import { useAccounts, useAccount, useDeleteAccount } from '@/hooks/useAccounts'
import { useDeleteContact } from '@/hooks/useContacts'
import { AccountForm, ACCOUNT_TYPE_LABELS } from '@/components/AccountForm'
import { ContactForm, type ContactRecord } from '@/components/ContactForm'
import { CountryBadge } from '@/components/CountryBadge'
import { StageBadge } from '@/components/StageBadge'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Account } from '@crm-plp/shared'

export function AccountsListPage() {
  const navigate = useNavigate()
  const { data: accounts = [], isLoading } = useAccounts()
  const del = useDeleteAccount()
  const confirmDialog = useConfirm()
  const [search, setSearch] = useState('')
  const [formAccount, setFormAccount] = useState<Partial<Account> & { id?: string } | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filtered = accounts.filter(
    (a) =>
      !search ||
      a.legal_name.toLowerCase().includes(search.toLowerCase()) ||
      a.country.toLowerCase().includes(search.toLowerCase()),
  )

  async function remove(a: Account) {
    const ok = await confirmDialog({
      title: `Excluir a conta "${a.legal_name}"?`,
      description: 'Esta ação não pode ser desfeita.',
    })
    if (ok) del.mutate(a.id)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Contas ({accounts.length})</h1>
        <div className="flex gap-2">
          <input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="input w-48 text-xs" />
          <button onClick={() => { setFormAccount(null); setShowForm(true) }} className="btn-primary text-xs">+ Nova</button>
        </div>
      </div>

      {showForm && (
        <AccountForm
          initial={formAccount ?? undefined}
          onClose={() => setShowForm(false)}
          onSaved={(id) => { if (!formAccount) navigate(`/contas/${id}`) }}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
              <tr>
                {['Conta', 'País', 'Tipo', 'Moeda', 'Segmento', ''].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} onClick={() => navigate(`/contas/${a.id}`)} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer group">
                  <td className="px-4 py-2.5 font-medium">{a.legal_name}</td>
                  <td className="px-4 py-2.5"><CountryBadge iso2={a.country_iso2} country={a.country} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ACCOUNT_TYPE_LABELS[a.account_type]}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{a.currency_default}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{a.segment ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={(e) => { e.stopPropagation(); setFormAccount(a); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" title="Editar"><Pencil size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); remove(a) }} className="p-1.5 text-gray-400 hover:text-red-600" title="Excluir"><Trash2 size={14} /></button>
                  </td>
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
  const del = useDeleteAccount()
  const delContact = useDeleteContact()
  const confirmDialog = useConfirm()
  const [tab, setTab] = useState<'quotes' | 'orders' | 'activity'>('quotes')
  const [editing, setEditing] = useState(false)
  const [contactForm, setContactForm] = useState<ContactRecord | null | undefined>(undefined) // undefined=closed, null=new, record=edit

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400">Carregando...</div>
  if (!account) return <div className="flex items-center justify-center h-full text-gray-400">Conta não encontrada</div>

  async function removeAccount() {
    if (!account) return
    const ok = await confirmDialog({
      title: `Excluir a conta "${account.legal_name}"?`,
      description: 'Os vínculos (contatos, histórico) serão removidos. Esta ação não pode ser desfeita.',
    })
    if (ok) del.mutate(account.id, { onSuccess: () => navigate('/contas') })
  }

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
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="btn-secondary text-xs">Editar</button>
            <button onClick={removeAccount} className="btn-danger text-xs">Excluir</button>
          </div>
        </div>
      </div>

      {editing && <AccountForm initial={account} onClose={() => setEditing(false)} />}
      {contactForm !== undefined && <ContactForm initial={contactForm ?? undefined} fixedAccountId={contactForm ? undefined : account.id} onClose={() => setContactForm(undefined)} />}

      {/* Contacts */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500">CONTATOS</h3>
          <button onClick={() => setContactForm(null)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">+ Adicionar</button>
        </div>
        <div className="flex flex-col gap-1">
          {(account.contacts ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center gap-2 text-sm group">
              <span className="font-medium">{c.name}</span>
              {c.role && <span className="text-gray-500 text-xs">· {c.role}</span>}
              {c.email && <span className="text-gray-400 text-xs">{c.email}</span>}
              {c.phone && <span className="text-gray-400 text-xs">{c.phone}</span>}
              <button onClick={() => setContactForm(c)} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 ml-1" title="Editar"><Pencil size={13} /></button>
              <button
                onClick={async () => {
                  if (await confirmDialog({ title: `Excluir o contato "${c.name}"?` })) delContact.mutate(c.id)
                }}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Excluir"
              ><Trash2 size={13} /></button>
            </div>
          ))}
          {(!account.contacts || account.contacts.length === 0) && <p className="text-xs text-gray-400">Nenhum contato.</p>}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-800 px-6">
        {(['quotes', 'orders', 'activity'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>
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
            {(!account.quotes || account.quotes.length === 0) && <p className="text-sm text-gray-400 text-center py-8">Nenhuma cotação</p>}
          </div>
        )}

        {tab === 'orders' && (
          <div className="flex flex-col gap-2">
            {(account.orders ?? []).map((o: any) => (
              <div key={o.id} onClick={() => navigate(`/pedidos/${o.id}`)} className="card p-3 cursor-pointer hover:border-brand-400 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{o.po_number ?? o.internal_number ?? o.id.slice(0, 8)}</p>
                  <p className="text-xs text-gray-500">{formatDate(o.received_at)}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(o.total_value, o.currency)}</span>
                <span className="text-xs text-gray-500">{o.status}</span>
              </div>
            ))}
            {(!account.orders || account.orders.length === 0) && <p className="text-sm text-gray-400 text-center py-8">Nenhum pedido</p>}
          </div>
        )}

        {tab === 'activity' && <ActivityTimeline accountId={id} />}
      </div>
    </div>
  )
}
