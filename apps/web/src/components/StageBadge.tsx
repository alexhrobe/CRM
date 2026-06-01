import { cn, STAGE_LABELS, STAGE_COLORS } from '@/lib/utils'

interface Props {
  stage: string
  size?: 'sm' | 'xs'
}

export function StageBadge({ stage, size = 'sm' }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs',
      STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600',
    )}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}
