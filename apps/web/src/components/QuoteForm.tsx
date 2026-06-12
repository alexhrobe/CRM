import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateQuoteSchema, type CreateQuote } from '@crm-plp/shared'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/lib/auth'
import { useCreateQuote, useUpdateQuote } from '@/hooks/useQuotes'
import { useFxRates } from '@/hooks/useFxRates'
import { PRODUCT_GROUP_LABELS } from '@/lib/utils'

interface Props {
  initial?: Partial<CreateQuote> & { id?: string }
  onSuccess?: (id: string) => void
  onCancel?: () => void
}

const CURRENCIES = ['USD', 'BRL', 'EUR', 'ARS', 'CLP', 'COP', 'PEN', 'PYG']

export function QuoteForm({ initial, onSuccess, onCancel }: Props) {
  const { user } = useAuth()
  const { data: accounts = [] } = useAccounts()
  const create = useCreateQuote()
  const update = useUpdateQuote()
  const { rateFor } = useFxRates()

  const isEdit = Boolean(initial?.id)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateQuote>({
    resolver: zodResolver(CreateQuoteSchema),
    defaultValues: {
      account_id: '',
      quote_number: '',
      quote_type: 'competitive',
      stage: 'received',
      currency: 'USD',
      received_at: new Date().toISOString().slice(0, 16),
      commission_pct_ds: 0,
      commission_pct_dfj: 0,
      commission_pct_other: 0,
      ...initial,
    },
  })

  // Ao trocar a moeda, sincroniza o câmbio com a taxa vigente daquela moeda.
  const currency = watch('currency')
  useEffect(() => {
    const r = rateFor(currency)
    if (r != null) setValue('fx_to_brl', r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency])

  async function onSubmit(values: CreateQuote) {
    if (!user) return
    // Preenche o câmbio com a taxa vigente se não informado (para a conversão BRL funcionar)
    const fx = values.fx_to_brl ?? rateFor(values.currency) ?? null
    const v = { ...values, fx_to_brl: Number.isNaN(values.fx_to_brl as number) ? (rateFor(values.currency) ?? null) : fx }
    if (isEdit && initial?.id) {
      const result = await update.mutateAsync({ id: initial.id, ...v })
      onSuccess?.(result.id)
    } else {
      const result = await create.mutateAsync({ ...v, owner_id: user.id })
      onSuccess?.(result.id)
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Conta *</label>
          <select {...register('account_id')} className="input">
            <option value="">Selecionar conta...</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.legal_name} ({a.country})</option>
            ))}
          </select>
          {errors.account_id && <p className="text-xs text-red-500 mt-1">{errors.account_id.message}</p>}
        </div>

        <div>
          <label className="label">Nº Proposta *</label>
          <input {...register('quote_number')} className="input" placeholder="EXP-2024-001" />
          {errors.quote_number && <p className="text-xs text-red-500 mt-1">{errors.quote_number.message}</p>}
        </div>

        <div>
          <label className="label">Tipo</label>
          <select {...register('quote_type')} className="input">
            <option value="competitive">Competitiva</option>
            <option value="reposition">Reposição</option>
          </select>
        </div>

        <div>
          <label className="label">Valor Total</label>
          <input
            type="number"
            step="0.01"
            {...register('total_value', { setValueAs: v => (v === '' || v == null ? null : Number(v)) })}
            className="input"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="label">Moeda</label>
          <select {...register('currency')} className="input">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Grupo de Produto</label>
          <select {...register('product_group', { setValueAs: v => (v ? v : null) })} className="input">
            <option value="">Selecionar...</option>
            {Object.entries(PRODUCT_GROUP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Recebida em *</label>
          <input type="datetime-local" {...register('received_at')} className="input" />
        </div>

        <div className="col-span-2">
          <label className="label">Descrição do Produto</label>
          <textarea
            {...register('product_description')}
            className="input resize-none"
            rows={2}
            placeholder="Descrição resumida dos itens..."
          />
        </div>

        <div>
          <label className="label">Previsão de fechamento</label>
          <input type="date" {...register('expected_close_at')} className="input" />
        </div>

        <div>
          <label className="label">FX para BRL</label>
          <input
            type="number"
            step="0.0001"
            {...register('fx_to_brl', { setValueAs: v => (v === '' || v == null ? null : Number(v)) })}
            className="input"
            placeholder="5.1000"
          />
        </div>

        <div>
          <label className="label">Comissão (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            {...register('commission_pct_ds', {
              setValueAs: v => (v === '' || v == null ? 0 : Number(v) / 100),
            })}
            className="input"
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end border-t border-gray-100 dark:border-gray-800 pt-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
        )}
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar Cotação'}
        </button>
      </div>
    </form>
  )
}
