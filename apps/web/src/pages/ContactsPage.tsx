import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts, useDeleteContact } from '@/hooks/useContacts'
import { ContactForm, type ContactRecord } from '@/components/ContactForm'
import { CountryBadge } from '@/components/CountryBadge'

export function ContactsPage() {
  const navigate = useNavigate()
  const { data: contacts = [], isLoading } = useContacts()
  const del = useDeleteContact()
  const [form, setForm] = useState<ContactRecord | null | undefined>(undefined) // undefined=closed, null=new, record=edit

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-sm font-semibold">Contatos ({contacts.length})</h1>
        <button onClick={() => setForm(null)} className="btn-primary text-xs">+ Novo</button>
      </div>

      {form !== undefined && <ContactForm initial={form ?? undefined} onClose={() => setForm(undefined)} />}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
              <tr>
                {['Nome', 'Cargo', 'Email', 'Telefone', 'Conta', 'País', ''].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{c.role ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <button onClick={() => navigate(`/contas/${c.account_id}`)} className="hover:underline">{c.account?.legal_name ?? '—'}</button>
                  </td>
                  <td className="px-4 py-2.5"><CountryBadge iso2={c.account?.country_iso2} country={c.account?.country} /></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setForm(c)} className="text-xs text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-1.5" title="Editar">✏️</button>
                    <button onClick={() => { if (confirm(`Excluir o contato "${c.name}"?`)) del.mutate(c.id) }} className="text-xs text-gray-400 hover:text-red-600 px-1.5" title="Excluir">🗑️</button>
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
