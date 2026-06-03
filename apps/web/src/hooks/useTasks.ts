import { useMemo } from 'react'
import { usePipelineQuotes } from '@/hooks/useQuotes'
import { deriveTasks, groupTasks } from '@/lib/automations/rules'

/** Tarefas de automação derivadas (ao vivo) do pipeline. */
export function useTasks() {
  const { data: quotes = [], isLoading } = usePipelineQuotes()
  const tasks = useMemo(() => deriveTasks(quotes), [quotes])
  const groups = useMemo(() => groupTasks(tasks), [tasks])
  return { tasks, groups, count: tasks.length, isLoading }
}
