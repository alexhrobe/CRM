import { cn } from '@/lib/utils'

interface Props {
  type: 'competitive' | 'reposition'
}

export function TypeBadge({ type }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 text-xs font-semibold rounded',
      type === 'competitive'
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
        : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    )}>
      {type === 'competitive' ? 'Comp' : 'Repos'}
    </span>
  )
}
