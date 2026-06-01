import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

Deno.serve(async (req) => {
  const { quote_id } = await req.json()

  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      *,
      account:accounts(legal_name, country, contacts(*)),
      activities(kind, title, body, occurred_at, user:users(name))
    `)
    .eq('id', quote_id)
    .single()

  if (!quote) {
    return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 })
  }

  const daysSinceSent = quote.sent_at
    ? Math.floor((Date.now() - new Date(quote.sent_at).getTime()) / 86400000)
    : null

  const contact = (quote.account as any)?.contacts?.[0]
  const recentActivities = ((quote.activities as any[]) ?? [])
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 5)
    .map(a => `  - ${a.kind}: ${a.title ?? ''} (${a.occurred_at.slice(0,10)})`)
    .join('\n')

  const prompt = `Você é o assistente comercial da PLP Brasil, empresa líder em hardware elétrico para transmissão e distribuição de energia.

Gere um email de follow-up profissional em ESPANHOL (idioma do cliente) para:

COTAÇÃO: ${quote.quote_number}
CLIENTE: ${(quote.account as any)?.legal_name} (${(quote.account as any)?.country})
CONTATO: ${contact?.name ?? 'Prezados'} (${contact?.role ?? ''})
PRODUTO: ${quote.product_description ?? quote.product_group ?? 'hardware elétrico'}
VALOR: ${quote.currency} ${quote.total_value?.toLocaleString()}
DIAS DESDE ENVIO: ${daysSinceSent ?? 'desconhecido'}

HISTÓRICO RECENTE:
${recentActivities || 'Nenhuma atividade registrada'}

INSTRUÇÕES:
- Tom: profissional mas próximo
- Reafirmar proposta de valor da PLP
- Perguntar sobre prazo de decisão e se há dúvidas técnicas
- Mencionar que pode agendar call técnica
- Máximo 200 palavras
- Assinar como "Equipe Comercial PLP Brasil"

Responda com o texto do email pronto para copiar/colar.`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const draft = (msg.content[0] as any).text

  return new Response(JSON.stringify({ draft }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
