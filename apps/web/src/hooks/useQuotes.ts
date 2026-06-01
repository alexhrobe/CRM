import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreateQuote, PipelineQuote, QuoteStage } from '@crm-plp/shared'

export function usePipelineQuotes() {
  return useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_pipeline_active')
        .select('*')
        .order('last_activity_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PipelineQuote[]
    },
  })
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`*, account:accounts(*), items:quote_items(*), activities(*, user:users(*))`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useAllQuotes() {
  return useQuery({
    queryKey: ['quotes', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`*, account:accounts(legal_name, country, country_iso2)`)
        .order('received_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateQuote & { owner_id: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useUpdateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreateQuote> & { id: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['quotes', vars.id] })
    },
  })
}

export function useDeleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useUpdateQuoteStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, stage, ...extra }: { id: string; stage: string; [k: string]: unknown }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update({ stage: stage as QuoteStage, decided_at: ['won','lost'].includes(stage) ? new Date().toISOString() : null, ...extra })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['quotes', vars.id] })
      qc.invalidateQueries({ queryKey: ['quotes', 'all'] })
    },
  })
}
