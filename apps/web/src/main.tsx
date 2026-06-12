import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { toast } from 'sonner'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
  // Feedback global: toda mutação dá retorno visível (sucesso/erro),
  // sem precisar instrumentar hook por hook. meta.success customiza a
  // mensagem; meta.silent = true desliga o toast de sucesso.
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const meta = mutation.meta as { success?: string; silent?: boolean } | undefined
      if (meta?.silent) return
      toast.success(meta?.success ?? 'Alterações salvas')
    },
    onError: (error) => {
      toast.error('Algo deu errado', { description: (error as Error).message })
    },
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
