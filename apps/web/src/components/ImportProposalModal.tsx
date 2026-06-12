import { useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ParsedProposalSchema, type ParsedProposal } from '@crm-plp/shared'
import { parseProposalBuffer } from '@/lib/proposal/parseProposal'
import { importProposal } from '@/lib/proposal/importProposal'
import { useAuth } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'

type Status = 'idle' | 'parsing' | 'preview' | 'importing'

interface Props {
  onClose: () => void
  onImported: (quoteId: string) => void
}

export function ImportProposalModal({ onClose, onImported }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [status, setStatus] = useState<Status>('idle')
  const [proposal, setProposal] = useState<ParsedProposal | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setErrors([])
    setStatus('parsing')
    try {
      const buf = await file.arrayBuffer()
      const draft = await parseProposalBuffer(buf)
      const res = ParsedProposalSchema.safeParse(draft)
      setProposal(draft)
      setErrors(res.success ? [] : res.error.issues.map((i) => i.message))
      setStatus('preview')
    } catch (err) {
      setErrors([(err as Error).message || 'Não consegui ler a planilha.'])
      setStatus('idle')
    }
  }

  async function confirm() {
    if (!proposal || !user) return
    setStatus('importing')
    try {
      const { quoteId } = await importProposal(proposal, user.id)
      qc.invalidateQueries() // recalcula pipeline + KPIs + dashboard
      onImported(quoteId)
    } catch (err) {
      const e = err as { message?: string; details?: string; hint?: string }
      const parts = [e.message, e.details, e.hint].filter(Boolean)
      setErrors([parts.join(' — ') || 'Falha ao importar.'])
      setStatus('preview')
    }
  }

  const canImport = status === 'preview' && errors.length === 0 && !!proposal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Importar proposta (Excel)</h2>
            <p className="text-xs text-gray-500">
              A planilha é lida em memória para criar conta, cotação e itens — não é armazenada.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm">
            ✕
          </button>
        </div>

        {/* Dropzone / file picker */}
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-8 cursor-pointer hover:border-brand-400 transition-colors">
          <span className="text-2xl">📄</span>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {fileName || 'Selecionar arquivo .xlsx da proposta'}
          </span>
          <span className="text-xs text-gray-400">clique para escolher</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleFile} />
        </label>

        {status === 'parsing' && <p className="mt-4 text-sm text-gray-400">Lendo a planilha…</p>}

        {errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <p className="font-medium mb-1">Não consegui extrair tudo:</p>
            <ul className="list-disc list-inside">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Ajuste os rótulos da planilha ou me envie um exemplo para calibrar o leitor.</p>
          </div>
        )}

        {/* Preview */}
        {proposal && status !== 'parsing' && (
          <div className="mt-4 flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente" value={proposal.account.legal_name} />
              <Field label="País" value={`${proposal.account.country}${proposal.account.country_iso2 ? ` (${proposal.account.country_iso2})` : ''}`} />
              <Field label="Proposta nº" value={proposal.quote.quote_number} />
              <Field label="Moeda" value={proposal.quote.currency} />
              <Field label="Contato" value={proposal.contact?.name ?? '—'} />
              <Field label="Valor total" value={formatCurrency(proposal.quote.total_value, proposal.quote.currency)} />
            </div>

            {proposal.items.length > 0 && (
              <div>
                <p className="label mb-1">Itens ({proposal.items.length})</p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500">
                      <th className="text-left py-1 px-2">Código</th>
                      <th className="text-left py-1 px-2">Descrição</th>
                      <th className="text-right py-1 px-2">Qtd</th>
                      <th className="text-right py-1 px-2">Unit.</th>
                      <th className="text-right py-1 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.items.slice(0, 12).map((it, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-1 px-2 font-mono">{it.product_code ?? '—'}</td>
                        <td className="py-1 px-2">{it.description ?? '—'}</td>
                        <td className="py-1 px-2 text-right">{it.quantity ?? '—'}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(it.unit_price, proposal.quote.currency)}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(it.total, proposal.quote.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {proposal.items.length > 12 && (
                  <p className="text-xs text-gray-400 mt-1">+{proposal.items.length - 12} itens…</p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={onClose} className="btn-ghost">
                Cancelar
              </button>
              <button onClick={confirm} disabled={!canImport} className="btn-primary">
                {status === 'importing' ? 'Importando…' : 'Criar cotação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  )
}
