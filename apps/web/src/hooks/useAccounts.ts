import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Account, AccountHealth } from '@crm-plp/shared'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('legal_name')
      if (error) throw error
      return (data ?? []) as Account[]
    },
  })
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select(`*, contacts(*), quotes(*, items:quote_items(*)), orders(*)`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useAccountHealth() {
  return useQuery({
    queryKey: ['account-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_account_health')
        .select('*')
        .order('pipeline_value_usd', { ascending: false })
      if (error) throw error
      return (data ?? []) as AccountHealth[]
    },
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Account, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts', vars.id] })
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['account-health'] })
    },
  })
}
