import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { createDemoClient } from './demo/client'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Sem credenciais (ou VITE_DEMO=1) → modo demo: cliente em memória com dados
// realistas, app 100% navegável sem backend. Com credenciais → cliente real.
const DEMO = import.meta.env.VITE_DEMO === '1' || !supabaseUrl || !supabaseAnonKey

const realClient = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
)

if (DEMO) {
  console.info('🧪 CRM em MODO DEMO — dados fictícios, sem backend.')
}

export const supabase: typeof realClient = DEMO
  ? (createDemoClient() as unknown as typeof realClient)
  : realClient

export type SupabaseClient = typeof supabase
