import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type ExecutiveSummary = Database['public']['Views']['v_executive_summary']['Row']
export type PipelineByAccount = Database['public']['Views']['v_pipeline_by_account']['Row']
export type JobRun = Database['public']['Tables']['job_runs']['Row']

export function useExecutiveSummary() {
  return useQuery({
    queryKey: ['executive-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_executive_summary')
        .select('*')
        .single()
      if (error) throw error
      return data as ExecutiveSummary
    },
    refetchInterval: 60_000,
  })
}

export function usePipelineByAccount() {
  return useQuery({
    queryKey: ['pipeline-by-account'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_pipeline_by_account')
        .select('*')
        .order('pipeline_brl', { ascending: false })
      if (error) throw error
      return (data ?? []) as PipelineByAccount[]
    },
    refetchInterval: 60_000,
  })
}

export function useRecentJobRuns(limit = 5) {
  return useQuery({
    queryKey: ['job-runs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as JobRun[]
    },
    refetchInterval: 120_000,
  })
}
