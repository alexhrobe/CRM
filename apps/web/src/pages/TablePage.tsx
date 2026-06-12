import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAllQuotes } from '@/hooks/useQuotes'
import { useFxRates } from '@/hooks/useFxRates'
import { KpiStrip } from '@/components/KpiStrip'
import { ListSkeleton } from '@/components/Skeleton'
import { StageBadge } from '@/components/StageBadge'
import { TypeBadge } from '@/components/TypeBadge'
import { CountryBadge } from '@/components/CountryBadge'
import {
  formatCurrency, formatDate, daysSince,
  PRODUCT_GROUP_LABELS, STAGE_LABELS,
} from '@/lib/utils'

type SortKey = 'received_at' | 'total_value' | 'stage' | 'account_name' | 'days'

const ACTIVE_STAGES = ['received', 'in_analysis', 'sent', 'negotiation', 'stalled']

function exportCSV(rows: any[], toBRL: (v: number | null, c: string, fx?: number | null) => number | null) {
  const headers = ['Data Recebida','Cliente','País','Nº Proposta','Produto','Valor','Moeda','Valor BRL','Estágio','Tipo','Idade(d)']
  const lines = rows.map(r => [
    formatDate(r.received_at),
    r.account?.legal_name ?? '',
    r.account?.country_iso2 ?? '',
    r.quote_number,
    PRODUCT_GROUP_LABELS[r.product_group] ?? '',
    r.total_value ?? '',
    r.currency,
    toBRL(r.total_value, r.currency, r.fx_to_brl)?.toFixed(2) ?? '',
    STAGE_LABELS[r.stage] ?? r.stage,
    r.quote_type === 'competitive' ? 'Comp' : 'Repos',
    daysSince(r.received_at),
  ].map(v => `"${v}"`).join(','))
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `cotacoes-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function TablePage() {
  const navigate = useNavigate()
  const { data: quotes = [], isLoading } = useAllQuotes()
  const { toBRL } = useFxRates()
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('received_at')
  const [sortDesc, setSortDesc] = useState(true)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(d => !d)
    else { setSortKey(key); setSortDesc(true) }
  }

  const STAGES = ['received','in_analysis','sent','negotiation','won','lost','expired','stalled']
  const TYPES = ['competitive','reposition']

  const filtered = useMemo(() => {
    let rows = quotes.filter((q: any) => {
      // sem filtro explícito → mostra só o pipeline ativo (igual Inbox/Kanban)
      const stages = stageFilter.length ? stageFilter : ACTIVE_STAGES
      if (!stages.includes(q.stage)) return false
      if (typeFilter.length && !typeFilter.includes(q.quote_type)) return false
      if (search) {
        const s = search.toLowerCase()
        if (
          !q.quote_number.toLowerCase().includes(s) &&
          !(q.account?.legal_name ?? '').toLowerCase().includes(s) &&
          !(q.product_description ?? '').toLowerCase().includes(s)
        ) return false
      }
      return true
    })
    rows = [...rows].sort((a: any, b: any) => {
      let va: any, vb: any
      if (sortKey === 'received_at') { va = a.received_at; vb = b.received_at }
      else if (sortKey === 'total_value') { va = a.total_value ?? 0; vb = b.total_value ?? 0 }
      else if (sortKey === 'stage') { va = a.stage; vb = b.stage }
      else if (sortKey === 'account_name') { va = a.account?.legal_name ?? ''; vb = b.account?.legal_name ?? '' }
      else { va = daysSince(a.received_at); vb = daysSince(b.received_at) }
      if (va < vb) return sortDesc ? 1 : -1
      if (va > vb) return sortDesc ? -1 : 1
      return 0
    })
    return rows
  }, [quotes, stageFilter, typeFilter, search, sortKey, sortDesc])

  function ThCell({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        onClick={() => toggleSort(k)}
        className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 select-none whitespace-nowrap"
      >
        {label} {sortKey === k ? (sortDesc ? '↓' : '↑') : ''}
      </th>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <KpiStrip />

      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-48 text-xs"
          />

          <select
            multiple
            className="input w-32 text-xs h-8"
            style={{ height: 32 }}
            onChange={e => setStageFilter(Array.from(e.target.selectedOptions).map(o => o.value))}
          >
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>

          <select
            multiple
            className="input w-24 text-xs"
            style={{ height: 32 }}
            onChange={e => setTypeFilter(Array.from(e.target.selectedOptions).map(o => o.value))}
          >
            {TYPES.map(t => <option key={t} value={t}>{t === 'competitive' ? 'Comp' : 'Repos'}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
            <a href="/" className="px-2.5 py-1 bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400">Inbox</a>
            <a href="/kanban" className="px-2.5 py-1 bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400">Kanban</a>
            <span className="px-2.5 py-1 bg-gray-900 text-white dark:bg-white dark:text-gray-900">Tabela</span>
          </div>
          <button onClick={() => exportCSV(filtered, toBRL)} className="btn-secondary text-xs">
            ↓ CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 z-10">
              <tr>
                <ThCell label="Recebida" k="received_at" />
                <ThCell label="Cliente" k="account_name" />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">País</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nº Proposta</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Produto</th>
                <ThCell label="Valor" k="total_value" />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">BRL</th>
                <ThCell label="Estágio" k="stage" />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tipo</th>
                <ThCell label="Idade" k="days" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q: any) => (
                <tr
                  key={q.id}
                  onClick={() => navigate(`/cotacoes/${q.id}`)}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                >
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(q.received_at)}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{q.account?.legal_name}</td>
                  <td className="px-3 py-2">
                    <CountryBadge iso2={q.account?.country_iso2} country={q.account?.country} />
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">{q.quote_number}</td>
                  <td className="px-3 py-2 text-xs max-w-xs truncate">
                    {q.product_group ? PRODUCT_GROUP_LABELS[q.product_group] : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right whitespace-nowrap">
                    {formatCurrency(q.total_value, q.currency)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-xs text-gray-400 whitespace-nowrap">
                    {toBRL(q.total_value, q.currency, q.fx_to_brl) != null
                      ? formatCurrency(toBRL(q.total_value, q.currency, q.fx_to_brl), 'BRL')
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StageBadge stage={q.stage} size="xs" />
                  </td>
                  <td className="px-3 py-2">
                    <TypeBadge type={q.quote_type} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 text-right">{daysSince(q.received_at)}d</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-gray-400 text-sm">
                    Nenhuma cotação encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
