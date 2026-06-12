import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePipelineQuotes } from '@/hooks/useQuotes'
import { KpiStrip } from '@/components/KpiStrip'
import { StageBadge } from '@/components/StageBadge'
import { TypeBadge } from '@/components/TypeBadge'
import { CountryBadge } from '@/components/CountryBadge'
import { QuoteForm } from '@/components/QuoteForm'
import { ImportProposalModal } from '@/components/ImportProposalModal'
import { ListSkeleton } from '@/components/Skeleton'
import {
  formatCurrency, formatRelativeDate, priorityScore,
  ALERT_SEVERITY_COLORS, PRODUCT_GROUP_LABELS
} from '@/lib/utils'
import type { PipelineQuote } from '@crm-plp/shared'

type ViewMode = 'inbox' | 'kanban' | 'table'

function QuoteRow({ quote }: { quote: PipelineQuote }) {
  const navigate = useNavigate()
  const daysLabel = `${Math.round(quote.days_in_stage)}d no estágio`

  return (
    <div
      onClick={() => navigate(`/cotacoes/${quote.id}`)}
      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 group"
    >
      {/* Severity dot */}
      <div className="mt-1.5 shrink-0">
        {quote.has_active_alert ? (
          <span className={`text-sm ${ALERT_SEVERITY_COLORS[quote.alert_severity ?? 'info']}`}>●</span>
        ) : (
          <span className="text-sm text-gray-200 dark:text-gray-700">●</span>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{quote.account_name}</span>
          <CountryBadge iso2={quote.country_iso2} country={quote.country} />
          <TypeBadge type={quote.quote_type} />
          {quote.product_group && (
            <span className="text-xs text-gray-400">{PRODUCT_GROUP_LABELS[quote.product_group]}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{quote.quote_number}</span>
          {quote.product_description && (
            <span className="text-xs text-gray-500 truncate max-w-xs">{quote.product_description}</span>
          )}
        </div>
        {/* Brain line */}
        {quote.has_active_alert && quote.alert_title && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs">✨</span>
            <span className="text-xs text-gray-400 italic">{quote.alert_title}</span>
          </div>
        )}
      </div>

      {/* Right metadata */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(quote.total_value, quote.currency)}
        </span>
        <div className="flex items-center gap-2">
          <StageBadge stage={quote.stage} size="xs" />
          <span className="text-xs text-gray-400">{daysLabel}</span>
        </div>
        <span className="text-xs text-gray-300 dark:text-gray-600">
          {formatRelativeDate(quote.last_activity_at)}
        </span>
      </div>
    </div>
  )
}

function Section({ title, quotes, defaultOpen = true }: {
  title: string
  quotes: PipelineQuote[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (quotes.length === 0) return null
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        {title}
        <span className="ml-auto font-normal normal-case">({quotes.length})</span>
      </button>
      {open && (
        <div className="animate-fade-in">
          {quotes.map(q => <QuoteRow key={q.id} quote={q} />)}
        </div>
      )}
    </div>
  )
}

export function InboxPage() {
  const { data: quotes = [], isLoading } = usePipelineQuotes()
  const [viewMode, setViewMode] = useState<ViewMode>('inbox')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const navigate = useNavigate()

  const sorted = useMemo(() =>
    [...quotes].sort((a, b) => priorityScore(b) - priorityScore(a)),
    [quotes]
  )

  const needsYou = sorted.filter(q =>
    q.stage === 'received' || q.stage === 'in_analysis' ||
    (q.stage === 'negotiation' && q.days_in_stage > 7)
  )
  const waitingClient = sorted.filter(q => q.stage === 'sent')
  const resting = sorted.filter(q => q.stage === 'stalled')

  if (viewMode === 'kanban') {
    navigate('/kanban')
    return null
  }
  if (viewMode === 'table') {
    navigate('/tabela')
    return null
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <KpiStrip />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Pipeline</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
            {(['inbox', 'kanban', 'table'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-2.5 py-1 transition-colors ${
                  viewMode === v
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400'
                }`}
              >
                {{ inbox: 'Inbox', kanban: 'Kanban', table: 'Tabela' }[v]}
              </button>
            ))}
          </div>
          <button onClick={() => setShowImport(true)} className="btn-secondary text-xs">
            ↥ Importar proposta
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs">
            + Nova Cotação
          </button>
        </div>
      </div>

      {/* Import proposal modal */}
      {showImport && (
        <ImportProposalModal
          onClose={() => setShowImport(false)}
          onImported={(id) => {
            setShowImport(false)
            navigate(`/cotacoes/${id}`)
          }}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Nova Cotação</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">✕</button>
            </div>
            <QuoteForm
              onSuccess={id => { setShowForm(false); navigate(`/cotacoes/${id}`) }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <span className="text-3xl">⬡</span>
            <p className="text-sm">Nenhuma cotação ativa</p>
            <button onClick={() => setShowForm(true)} className="btn-secondary text-xs">
              Criar primeira cotação
            </button>
          </div>
        ) : (
          <>
            <Section title="Precisa de você agora" quotes={needsYou} />
            <Section title="Aguardando cliente" quotes={waitingClient} />
            <Section title="Em descanso" quotes={resting} defaultOpen={false} />
          </>
        )}
      </div>
    </div>
  )
}
