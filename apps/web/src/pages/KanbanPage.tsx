import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePipelineQuotes, useUpdateQuoteStage, useDeleteQuote } from '@/hooks/useQuotes'
import { KpiStrip } from '@/components/KpiStrip'
import { QuoteForm } from '@/components/QuoteForm'
import { formatCurrency, PRODUCT_GROUP_LABELS } from '@/lib/utils'
import type { PipelineQuote } from '@crm-plp/shared'

const COLUMNS = [
  { id: 'received',    label: 'Recebida',   dot: 'bg-stone-400' },
  { id: 'in_analysis', label: 'Em análise', dot: 'bg-blue-500' },
  { id: 'sent',        label: 'Enviada',    dot: 'bg-emerald-600' },
  { id: 'negotiation', label: 'Negociação', dot: 'bg-amber-400' },
]

function formatCompact(value: number) {
  if (value >= 1_000_000) return `USD ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000)     return `USD ${Math.round(value / 1_000)}k`
  return formatCurrency(value, 'USD')
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-lg leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Quote card ─────────────────────────────────────────────────────────────────

function QuoteCard({ quote, onDelete }: { quote: PipelineQuote; onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const [confirmDel, setConfirmDel] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: quote.id })

  const staleThreshold = quote.stage === 'received' ? 3 : quote.stage === 'sent' ? 6 : 10
  const isStale = quote.days_in_stage > staleThreshold

  const description = quote.product_description?.trim() ||
    (quote.product_group ? PRODUCT_GROUP_LABELS[quote.product_group] : null)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      className="group relative card cursor-grab active:cursor-grabbing hover:border-brand-400 hover:shadow-sm transition-all"
    >
      {/* Main clickable content */}
      <div className="p-3" onClick={() => navigate(`/cotacoes/${quote.id}`)}>
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="font-medium text-sm leading-tight truncate pr-6">{quote.account_name}</span>
          <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 font-mono">{quote.country_iso2 ?? '—'}</span>
        </div>

        {description && (
          <p className="text-xs text-gray-400 mb-2 truncate">{description}</p>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-semibold tabular-nums">
            {formatCurrency(quote.total_value, quote.currency)}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            quote.quote_type === 'competitive'
              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
          }`}>
            {quote.quote_type === 'competitive' ? 'Comp' : 'Repos'}
          </span>
        </div>

        {isStale && (
          <div className="flex items-center gap-1 mt-1.5">
            <svg className="w-3 h-3 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span className="text-[10px] text-orange-500">{Math.round(quote.days_in_stage)}d no estágio</span>
          </div>
        )}

        {quote.has_active_alert && !isStale && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400 italic">
            <span>✨</span>
            <span className="truncate">{quote.alert_title}</span>
          </div>
        )}
      </div>

      {/* Hover action buttons */}
      {!confirmDel && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); navigate(`/cotacoes/${quote.id}`) }}
            title="Abrir cotação"
            className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 shadow-sm"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
            title="Excluir cotação"
            className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 shadow-sm"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Inline delete confirmation overlay */}
      {confirmDel && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-white/96 dark:bg-gray-900/96 rounded-lg border border-red-200 dark:border-red-900/50"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center px-4">
            Excluir <span className="font-semibold">{quote.account_name}</span>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onDelete(quote.id)}
              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Excluir
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Column ─────────────────────────────────────────────────────────────────────

function Column({
  stageId, label, dot, quotes, onDelete,
}: {
  stageId: string
  label: string
  dot: string
  quotes: PipelineQuote[]
  onDelete: (id: string) => void
}) {
  const { setNodeRef } = useSortable({ id: stageId })
  const total = quotes.reduce((s, q) => s + (q.total_value ?? 0), 0)

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-64 shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3"
    >
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-1.5 py-0.5 tabular-nums">
            {quotes.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[10px] text-gray-400 tabular-nums">{formatCompact(total)}</span>
        )}
      </div>

      <SortableContext items={quotes.map(q => q.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
          {quotes.map(q => (
            <QuoteCard key={q.id} quote={q} onDelete={onDelete} />
          ))}
          {quotes.length === 0 && (
            <div className="flex items-center justify-center flex-1 min-h-[80px] text-xs text-gray-300 dark:text-gray-700 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
              Solte aqui
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'competitive' | 'reposition'

export function KanbanPage() {
  const { data: quotes = [], isLoading } = usePipelineQuotes()
  const updateStage = useUpdateQuoteStage()
  const deleteQuote = useDeleteQuote()
  const navigate = useNavigate()

  const [activeQuote, setActiveQuote] = useState<PipelineQuote | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterCountry, setFilterCountry] = useState<string>('')
  const [showNewQuote, setShowNewQuote] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const filtered = useMemo(() => quotes.filter(q => {
    if (filterType !== 'all' && q.quote_type !== filterType) return false
    if (filterCountry && q.country_iso2 !== filterCountry) return false
    return true
  }), [quotes, filterType, filterCountry])

  const countries = useMemo(() => {
    const map = new Map<string, string>()
    quotes.forEach(q => { if (q.country_iso2) map.set(q.country_iso2, q.country ?? q.country_iso2) })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [quotes])

  const totalValue = filtered.reduce((s, q) => s + (q.total_value ?? 0), 0)
  const byStage = (stage: string) => filtered.filter(q => q.stage === stage)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveQuote(null)
    if (!over || active.id === over.id) return

    const targetStage =
      COLUMNS.find(c => c.id === over.id)?.id ??
      quotes.find(q => q.id === over.id)?.stage

    const currentStage = quotes.find(q => q.id === active.id)?.stage
    if (targetStage && targetStage !== currentStage) {
      updateStage.mutate({ id: active.id as string, stage: targetStage })
    }
  }

  function handleDelete(id: string) {
    deleteQuote.mutate(id)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <KpiStrip />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 gap-4 shrink-0">
        <div>
          <h1 className="text-sm font-semibold">Pipeline de cotações</h1>
          <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'ativa' : 'ativas'} · {formatCompact(totalValue)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
            <Link to="/" className="px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Inbox
            </Link>
            <span className="px-2.5 py-1.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-medium">
              Kanban
            </span>
            <Link to="/tabela" className="px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Tabela
            </Link>
          </div>
          <button
            onClick={() => setShowNewQuote(true)}
            className="btn-primary text-xs py-1.5 px-3"
          >
            + Nova
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 dark:border-gray-800/60 flex-wrap shrink-0">
        <span className="text-[11px] text-gray-400 mr-1">Tipo:</span>
        {(['all', 'competitive', 'reposition'] as FilterType[]).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] transition-colors ${
              filterType === t
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-medium'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t === 'all' ? 'Todos' : t === 'competitive' ? 'Competitiva' : 'Reposição'}
          </button>
        ))}

        {countries.length > 1 && (
          <>
            <span className="text-gray-200 dark:text-gray-700 mx-0.5">|</span>
            <span className="text-[11px] text-gray-400 mr-1">País:</span>
            <button
              onClick={() => setFilterCountry('')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] transition-colors ${
                filterCountry === ''
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-medium'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Todos
            </button>
            {countries.map(([iso2]) => (
              <button
                key={iso2}
                onClick={() => setFilterCountry(iso2 === filterCountry ? '' : iso2)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-colors ${
                  filterCountry === iso2
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {iso2}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            Carregando...
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={e => setActiveQuote(quotes.find(q => q.id === e.active.id) ?? null)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 pb-4 min-h-full items-start">
              {COLUMNS.map(col => (
                <Column
                  key={col.id}
                  stageId={col.id}
                  label={col.label}
                  dot={col.dot}
                  quotes={byStage(col.id)}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
              {activeQuote && (
                <div className="card p-3 shadow-2xl w-64 rotate-1 text-sm border-brand-400 border">
                  <p className="font-medium">{activeQuote.account_name}</p>
                  <p className="text-xs text-gray-400 mt-1 tabular-nums">
                    {formatCurrency(activeQuote.total_value, activeQuote.currency)}
                  </p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Nova cotação modal */}
      {showNewQuote && (
        <Modal title="Nova Cotação" onClose={() => setShowNewQuote(false)}>
          <QuoteForm
            onSuccess={id => { setShowNewQuote(false); navigate(`/cotacoes/${id}`) }}
            onCancel={() => setShowNewQuote(false)}
          />
        </Modal>
      )}
    </div>
  )
}
