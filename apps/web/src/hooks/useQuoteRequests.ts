import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreateQuoteRequest, QuoteRequestWithAccount, RequestStatus } from '@crm-plp/shared'

/** Solicitações de orçamento em ordem de chegada (mais antiga primeiro). */
export function useQuoteRequests(status: RequestStatus | 'all' = 'all') {
  return useQuery({
    queryKey: ['quote-requests', status],
    queryFn: async () => {
      const base = supabase
        .from('quote_requests')
        .select('*, account:accounts(legal_name, country, country_iso2)')
      const filtered = status === 'all' ? base : base.eq('status', status)
      const { data, error } = await filtered.order('received_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as QuoteRequestWithAccount[]
    },
  })
}

export function useCreateQuoteRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateQuoteRequest) => {
      const { data, error } = await supabase
        .from('quote_requests')
        .insert({
          from_name: input.from_name,
          from_email: input.from_email ?? null,
          subject: input.subject ?? null,
          body: input.body ?? null,
          account_id: input.account_id ?? null,
          received_at: input.received_at,
          status: 'new',
          source: 'manual',
        })
        .select('id')
        .single()
      if (error) throw error
      return data!
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useUpdateQuoteRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<{ status: RequestStatus; quote_id: string | null; account_id: string | null }>) => {
      const { error } = await supabase.from('quote_requests').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useDeleteQuoteRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quote_requests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}
