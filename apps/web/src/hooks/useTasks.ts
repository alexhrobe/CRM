import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { AutomationTask, TaskKind } from '@/lib/automations/rules'
import { groupTasks } from '@/lib/automations/rules'
import type { Database } from '@/lib/database.types'

type ActionQueueRow = Database['public']['Views']['v_action_queue']['Row']

function rowToTask(row: ActionQueueRow): AutomationTask {
  return {
    id: row.id!,
    quoteId: row.quote_id!,
    quoteNumber: row.quote_number!,
    accountName: row.account_name!,
    countryIso2: row.country_iso2,
    stage: row.stage!,
    kind: row.task_kind as TaskKind,
    severity: row.severity!,
    title: row.title!,
    detail: row.detail!,
    totalValue: row.total_value,
    currency: row.currency!,
    overdueDays: row.overdue_days ?? 0,
    dueInDays: row.due_in_days,
    sortValueBrl: row.sort_value_brl ?? 0,
  }
}

/** Fila de ação unificada — lê v_action_queue (Postgres, mesmas regras de rules.ts). */
export function useTasks() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['action-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_action_queue')
        .select('*')
        .order('severity_ord')
        .order('overdue_days', { ascending: false })
        .order('sort_value_brl', { ascending: false })
      if (error) throw error
      return (data ?? []) as ActionQueueRow[]
    },
    refetchInterval: 60_000,
  })

  const tasks = useMemo(() => rows.map(rowToTask), [rows])
  const groups = useMemo(() => groupTasks(tasks), [tasks])
  return { tasks, groups, count: tasks.length, isLoading }
}
