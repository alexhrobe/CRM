import { serviceClient as supabase, isAuthorizedCron, getAuthedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

/**
 * Job diário de manutenção — delega para run_daily_maintenance() no Postgres.
 * Estágios stalled/expired, log em job_runs. Alertas operacionais vêm de
 * v_action_queue (view ao vivo), não são mais gravados em brain_alerts aqui.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!isAuthorizedCron(req)) {
    const user = await getAuthedUser(req)
    if (!user || user.role !== 'owner') return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const { data, error } = await supabase.rpc('run_daily_maintenance')
    if (error) {
      console.error('run_daily_maintenance failed:', error)
      return jsonResponse({ error: error.message }, 500)
    }
    return jsonResponse(data ?? { ok: true })
  } catch (err) {
    console.error('brain-scan failed:', err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
