import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { ReportKpis } from '@crm-plp/shared'

export function ReportListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const closeMonth = useMutation({
    mutationFn: async (period: string) => {
      const { data, error } = await supabase.functions.invoke('close-month', {
        body: { period },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      if (data?.slug) navigate(`/relatorio/${data.slug}`)
    },
  })

  const currentPeriod = new Date().toISOString().slice(0, 7)
  const hasCurrentMonth = reports.some((r: any) => r.period === currentPeriod)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Relatórios Mensais</h1>
        {!hasCurrentMonth && (
          <button
            onClick={() => closeMonth.mutate(currentPeriod)}
            disabled={closeMonth.isPending}
            className="btn-primary text-xs"
          >
            {closeMonth.isPending ? 'Gerando...' : `Fechar mês de ${currentPeriod}`}
          </button>
        )}
      </div>

      {closeMonth.isError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          Erro ao fechar mês: {(closeMonth.error as Error).message}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
            <span className="text-3xl">📊</span>
            <p className="text-sm">Nenhum relatório ainda</p>
            <p className="text-xs">Clique em "Fechar mês" para gerar o primeiro.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((r: any) => (
              <div
                key={r.id}
                onClick={() => navigate(`/relatorio/${r.slug}`)}
                className="card p-4 cursor-pointer hover:border-brand-400 flex items-center gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.title}</span>
                    {r.published && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
                        Publicado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Período: {r.period}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
                  <a
                    href={`/r/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Link público →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ReportDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select(`*, snapshots:report_snapshots(*)`)
        .eq('slug', slug!)
        .single()
      if (error) throw error
      return data
    },
  })

  const [editNarrative, setEditNarrative] = useState('')
  const [editing, setEditing] = useState(false)

  const saveNarrative = useMutation({
    mutationFn: async (narrative: string) => {
      const { error } = await supabase
        .from('monthly_reports')
        .update({ narrative })
        .eq('slug', slug!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', slug] })
      setEditing(false)
    },
  })

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('monthly_reports')
        .update({ published: true, published_at: new Date().toISOString() })
        .eq('slug', slug!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', slug] }),
  })

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400">Carregando...</div>
  if (!report) return <div className="flex items-center justify-center h-full text-gray-400">Relatório não encontrado</div>

  const kpis = report.snapshots?.find((s) => s.metric_key === 'kpis')?.payload as
    | ReportKpis
    | undefined

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/relatorio')} className="text-xs text-gray-400 hover:text-gray-700 mb-1">← Relatórios</button>
          <h1 className="text-lg font-semibold">{report.title}</h1>
          <p className="text-xs text-gray-500">Período: {report.period}</p>
        </div>
        <div className="flex gap-2">
          {!report.published && (
            <button onClick={() => publish.mutate()} disabled={publish.isPending} className="btn-secondary text-xs">
              Publicar
            </button>
          )}
          <a href={`/r/${slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">
            Ver público →
          </a>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6 max-w-4xl">
        {/* KPIs */}
        {kpis && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">KPIs do Mês</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="label">Cotações Recebidas</p><p className="text-2xl font-bold">{kpis.quotes_received}</p></div>
              <div><p className="label">Cotações Enviadas</p><p className="text-2xl font-bold">{kpis.quotes_sent}</p></div>
              <div><p className="label">Pedidos</p><p className="text-2xl font-bold">{kpis.orders_received}</p></div>
            </div>
          </div>
        )}

        {/* Narrative */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Narrativa</h3>
            <button onClick={() => { setEditNarrative(report.narrative ?? ''); setEditing(e => !e) }} className="btn-ghost text-xs">
              {editing ? 'Cancelar' : 'Editar'}
            </button>
          </div>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editNarrative}
                onChange={e => setEditNarrative(e.target.value)}
                rows={12}
                className="input resize-none text-sm font-mono"
              />
              <button onClick={() => saveNarrative.mutate(editNarrative)} disabled={saveNarrative.isPending} className="btn-primary text-xs self-end">
                Salvar
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {report.narrative ?? <span className="text-gray-400 italic">Narrativa não gerada ainda.</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
