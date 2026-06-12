import { cn } from '@/lib/utils'

/** Linhas fantasma enquanto a lista carrega (substitui "Carregando…"). */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('animate-pulse', className)} aria-label="Carregando" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded bg-gray-200 dark:bg-gray-800 w-1/3" />
            <div className="h-2.5 rounded bg-gray-100 dark:bg-gray-800/60 w-1/2" />
          </div>
          <div className="h-3 rounded bg-gray-200 dark:bg-gray-800 w-20" />
        </div>
      ))}
    </div>
  )
}
