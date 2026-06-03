import { useState, type FormEvent } from 'react'
import { useCreateContact, useUpdateContact } from '@/hooks/useContacts'
import { useAccounts } from '@/hooks/useAccounts'

export interface ContactRecord {
  id?: string
  account_id?: string
  name?: string
  role?: string | null
  email?: string | null
  phone?: string | null
}

interface Props {
  initial?: ContactRecord
  fixedAccountId?: string
  onClose: () => void
}

export function ContactForm({ initial, fixedAccountId, onClose }: Props) {
  const { data: accounts = [] } = useAccounts()
  const create = useCreateContact()
  const update = useUpdateContact()
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState({
    account_id: initial?.account_id ?? fixedAccountId ?? '',
    name: initial?.name ?? '',
    role: initial?.role ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.account_id) return
    if (isEdit && initial?.id) {
      await update.mutateAsync({ id: initial.id, name: form.name, role: form.role || null, email: form.email || null, phone: form.phone || null })
    } else {
      await create.mutateAsync({ account_id: form.account_id, name: form.name, role: form.role || null, email: form.email || null, phone: form.phone || null })
    }
    onClose()
  }

  const pending = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-md p-5 shadow-xl animate-fade-in">
        <h2 className="font-semibold mb-4">{isEdit ? 'Editar contato' : 'Novo contato'}</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {!fixedAccountId && !isEdit && (
            <div>
              <label className="label">Conta *</label>
              <select required value={form.account_id} onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))} className="input">
                <option value="">— selecione —</option>
                {accounts.map((a: { id: string; legal_name: string }) => <option key={a.id} value={a.id}>{a.legal_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cargo</label>
              <input value={form.role ?? ''} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input" />
            </div>
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={pending || !form.name.trim() || !form.account_id} className="btn-primary">
              {pending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
