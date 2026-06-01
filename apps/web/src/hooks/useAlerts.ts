import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BrainAlert } from '@crm-plp/shared'

export function useActiveAlerts() {
  return useQuery({
    queryKey: ['brain-alerts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brain_alerts')
        .select(`*, account:accounts(legal_name), quote:quotes(quote_number, stage)`)
        .eq('dismissed', false)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as (BrainAlert & { account?: { legal_name: string }; quote?: { quote_number: string; stage: string } })[]
    },
    refetchInterval: 1000 * 60 * 5,
  })
}

export function useDismissAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('brain_alerts')
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brain-alerts'] }),
  })
}
