import { serviceClient as supabase, getAuthedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getAuthedUser(req)
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const { quote_id } = await req.json()
  if (!quote_id || typeof quote_id !== 'string') {
    return jsonResponse({ error: 'quote_id is required' }, 400)
  }

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
    return jsonResponse({ error: 'Quote not found' }, 404)
  }

  const daysSinceSent = quote.sent_at
    ? Math.floor((Date.now() - new Date(quote.sent_at).getTime()) / 86400000)
    : null

  const contact = (quote.account as any)?.contacts?.[0]

  const contactName = contact?.name ?? 'Prezados'
  const clientCompany = (quote.account as any)?.legal_name ?? 'su empresa'
  const quoteNum = quote.quote_number
  const valText = quote.total_value ? `${quote.currency} ${quote.total_value.toLocaleString()}` : ''
  const prodText = quote.product_description || quote.product_group || 'hardware eléctrico'

  const formalDraft = `Estimado/a ${contactName},

Espero que se encuentre muy bien.

Nos ponemos en contacto en relación con la propuesta comercial ${quoteNum} enviada para ${clientCompany}, referente a ${prodText}${valText ? ` por un valor total de ${valText}` : ''}.

Quisiéramos saber si han tenido la oportunidad de revisar la documentación técnica y comercial, y si existe alguna duda u observación en la que podamos asistirle. Si lo considera oportuno, podemos coordinar una breve llamada con nuestro equipo técnico para aclarar cualquier punto de la especificación.

Agradecemos de antemano su atención y quedamos a su entera disposición.

Atentamente,
Equipe Comercial — CRM Export`

  const comercialDraft = `Hola ${contactName},

¿Cómo está? Espero que todo vaya bien.

Le escribo para hacer el seguimiento de nuestra propuesta ${quoteNum} para el suministro de ${prodText}.

Estamos listos para avanzar con su pedido y coordinar el cronograma de producción de la fábrica. ¿Tienen alguna previsión sobre las próximas etapas de decisión o necesitan que ajustemos alguna de las condiciones comerciales presentadas?

Quedo atento a sus comentarios.

Un cordial saludo,
Equipe Comercial — CRM Export`

  const urgenteDraft = `Estimado/a ${contactName},

Espero que se encuentre bien.

Le escribo con respecto a la propuesta ${quoteNum} (${prodText}) que enviamos hace unos días. Dado que estamos cerrando la programación de producción para las próximas semanas, nos gustaría confirmar si el proyecto sigue en pie y si tienen una fecha estimada para la adjudicación.

Si requiere una actualización del plazo de entrega o alguna aclaración urgente, por favor hágamelo saber para gestionarlo de inmediato.

Quedo a la espera de su amable respuesta.

Saludos cordiales,
Equipe Comercial — CRM Export`

  const draft = `--- OPCIÓN 1: FORMAL / TÉCNICO ---
${formalDraft}

--- OPCIÓN 2: COMERCIAL / SEGUIMIENTO ---
${comercialDraft}

--- OPCIÓN 3: URGENTE / CRONOGRAMA ---
${urgenteDraft}`

  return jsonResponse({ draft })
})
