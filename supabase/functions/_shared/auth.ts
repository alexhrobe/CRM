import { createClient } from 'npm:@supabase/supabase-js'

/**
 * Cliente com service_role — IGNORA RLS. Use só depois de autorizar o chamador
 * com os helpers abaixo. Nunca exponha esta chave fora das Edge Functions.
 */
export const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

export type Role = 'owner' | 'assistant'
export interface AuthedUser {
  id: string
  role: Role
}

/** Verifica o JWT do chamador e devolve o usuário + papel (da tabela users). */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? ''
  if (!token) return null
  const { data: { user }, error } = await serviceClient.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  return { id: user.id, role: (profile?.role ?? 'assistant') as Role }
}

/** True se o Authorization bearer for exatamente a service_role key. */
export function isServiceRole(req: Request): boolean {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return !!token && !!key && token === key
}

/**
 * Autorização para funções de cron (brain-scan, import-fx-rates):
 * aceita um segredo compartilhado (x-cron-secret) OU a service_role key.
 */
export function isAuthorizedCron(req: Request): boolean {
  if (isServiceRole(req)) return true
  const secret = Deno.env.get('CRON_SECRET')
  return !!secret && req.headers.get('x-cron-secret') === secret
}
