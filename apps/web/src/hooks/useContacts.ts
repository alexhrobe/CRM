import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ContactInput {
  account_id: string
  name: string
  role?: string | null
  email?: string | null
  phone?: string | null
  language?: string
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, account:accounts(legal_name, country, country_iso2)')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ContactInput) => {
      const { data, error } = await supabase.from('contacts').insert(input).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ContactInput>) => {
      const { data, error } = await supabase.from('contacts').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}
