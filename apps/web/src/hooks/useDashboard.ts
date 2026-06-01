import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CountryMetrics, MonthlyKpi } from '@crm-plp/shared'

export function useCountryMetrics() {
  return useQuery({
    queryKey: ['country-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_country_metrics')
        .select('*')
      if (error) throw error
      return (data ?? []) as CountryMetrics[]
    },
  })
}

export function useMonthlyKpis() {
  return useQuery({
    queryKey: ['monthly-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_monthly_kpis')
        .select('*')
        .order('month', { ascending: true })
      if (error) throw error
      return (data ?? []) as MonthlyKpi[]
    },
  })
}

export function useCurrentMonthKpis() {
  return useQuery({
    queryKey: ['kpis-current'],
    queryFn: async () => {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
        .toISOString().slice(0, 7)

      const [curr, prev] = await Promise.all([
        supabase.from('v_monthly_kpis').select('*').eq('month', currentMonth).single(),
        supabase.from('v_monthly_kpis').select('*').eq('month', prevMonth).single(),
      ])

      return {
        current: curr.data as MonthlyKpi | null,
        previous: prev.data as MonthlyKpi | null,
      }
    },
  })
}
