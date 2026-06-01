import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreateActivity } from '@crm-plp/shared'

export function useActivities(filters?: { quoteId?: string; accountId?: string; orderId?: string }) {
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: async () => {
      let q = supabase
        .from('activities')
        .select(`*, user:users(name, role), contact:contacts(name)`)
        .order('occurred_at', { ascending: false })
      if (filters?.quoteId) q = q.eq('quote_id', filters.quoteId)
      if (filters?.accountId) q = q.eq('account_id', filters.accountId)
      if (filters?.orderId) q = q.eq('order_id', filters.orderId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateActivity & { user_id: string; account_id?: string }) => {
      const { data, error } = await supabase
        .from('activities')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['activities'] })
      if (vars.quote_id) qc.invalidateQueries({ queryKey: ['quotes', vars.quote_id] })
      if (vars.account_id) qc.invalidateQueries({ queryKey: ['accounts', vars.account_id] })
    },
  })
}
