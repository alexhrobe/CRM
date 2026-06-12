import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

/** Diálogo de confirmação com API de promise: `if (await confirm({...}))`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>()

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function close(result: boolean) {
    resolver.current?.(result)
    resolver.current = undefined
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={opts.title}
            className="card w-full max-w-sm p-5 shadow-xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm">{opts.title}</h2>
                {opts.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opts.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button autoFocus onClick={() => close(false)} className="btn-ghost text-xs">
                {opts.cancelLabel ?? 'Cancelar'}
              </button>
              <button onClick={() => close(true)} className="btn-danger text-xs">
                {opts.confirmLabel ?? 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}
