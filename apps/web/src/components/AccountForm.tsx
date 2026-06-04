import { useState, type FormEvent } from 'react'
import { useCreateAccount, useUpdateAccount } from '@/hooks/useAccounts'
import type { Account } from '@crm-plp/shared'

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  direct_customer: 'Cliente Direto',
  subsidiary: 'Subsidiária',
  distributor: 'Distribuidor',
  representative: 'Representante',
  partner: 'Parceiro',
}

interface Props {
  initial?: Partial<Account> & { id?: string }
  onClose: () => void
  onSaved?: (id: string) => void
}

export function AccountForm({ initial, onClose, onSaved }: Props) {
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState({
    legal_name: initial?.legal_name ?? '',
    country: initial?.country ?? '',
    country_iso2: initial?.country_iso2 ?? '',
    account_type: (initial?.account_type ?? 'direct_customer') as Account['account_type'],
    currency_default: initial?.currency_default ?? 'USD',
    segment: initial?.segment ?? '',
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const base = {
      legal_name: form.legal_name,
      country: form.country,
      country_iso2: form.country_iso2 || null,
      account_type: form.account_type,
      currency_default: form.currency_default,
      segment: form.segment || null,
    }
    if (isEdit && initial?.id) {
      await update.mutateAsync({ id: initial.id, ...base })
      onSaved?.(initial.id)
    } else {
      const r = await create.mutateAsync({ ...base, parent_account_id: null, notes: null })
      onSaved?.(r.id)
    }
    onClose()
  }

  const pending = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-5 shadow-xl animate-fade-in">
        <h2 className="font-semibold mb-4">{isEdit ? 'Editar Conta' : 'Nova Conta'}</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Razão Social *</label>
              <input required value={form.legal_name} onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">País *</label>
              <input required value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="input" placeholder="Argentina" />
            </div>
            <div>
              <label className="label">ISO2</label>
              <input maxLength={2} value={form.country_iso2 ?? ''} onChange={(e) => setForm((f) => ({ ...f, country_iso2: e.target.value.toUpperCase() }))} className="input" placeholder="AR" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value as Account['account_type'] }))} className="input">
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Moeda padrão</label>
              <select value={form.currency_default} onChange={(e) => setForm((f) => ({ ...f, currency_default: e.target.value }))} className="input">
                {['USD', 'BRL', 'EUR', 'ARS', 'CLP', 'COP', 'PEN', 'PYG'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Segmento</label>
              <input value={form.segment ?? ''} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} className="input" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={pending || !form.legal_name || !form.country} className="btn-primary">
              {pending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
