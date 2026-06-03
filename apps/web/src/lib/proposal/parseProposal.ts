/**
 * Parser determinístico de proposta em Excel (.xlsx).
 *
 * Calibrado para o modelo comercial da PLP (espanhol) e tolerante a variações:
 * combina rótulos, valor "inline" (label: valor na mesma célula), bloco de
 * cliente posicional (linha após "A") e detecção da tabela de itens pelos
 * cabeçalhos. Os mapas abaixo são o único ponto a ajustar para outros modelos.
 *
 * A planilha NÃO é persistida — só é lida em memória para alimentar o cadastro.
 */
import type { ParsedProposal, ProposalItem } from '@crm-plp/shared'

// ─── Mapas de rótulo (ajuste aqui) ────────────────────────────────────────────
export const LABELS = {
  legal_name: ['cliente', 'client', 'empresa', 'razao social', 'customer', 'comprador'],
  country: ['pais', 'country', 'destino'],
  contact_name: ['contato', 'contact', 'atencion', 'atn', 'att', 'a/c', 'responsavel'],
  email: ['email', 'e-mail', 'correo'],
  phone: ['telefone', 'fone', 'phone', 'tel', 'celular', 'whatsapp'],
  quote_number: ['n ref', 'no ref', 'ref', 'referencia', 'proposta', 'cotacion', 'cotacao', 'quote', 'numero', 'oferta', 'orcamento'],
  currency: ['moeda', 'moneda', 'currency', 'divisa'],
  total: ['total cotizacion', 'valor total', 'total geral', 'total da proposta', 'importe total', 'grand total', 'total'],
  product_description: ['objeto', 'asunto', 'descricao da proposta', 'projeto', 'obra'],
} as const

const ITEM_HEADERS = {
  product_code: ['referencia', 'codigo', 'code', 'cod', 'sku', 'part number', 'pn'],
  description: ['descripcion', 'descricao', 'description', 'produto', 'product', 'detalhe'],
  quantity: ['cantidad', 'qtd', 'quant', 'quantidade', 'quantity', 'qty', 'cant'],
  unit_price: ['precio un', 'precio unit', 'precio unitario', 'preco unit', 'preco unitario', 'valor unit', 'unit price', 'p unit'],
  total: ['precio total', 'valor total', 'importe', 'total', 'subtotal', 'amount'],
} as const

const DIACRITICS = /[̀-ͯ]/g
function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '') // remove acentos
    .replace(/[ºª°#]/g, ' ') // ordinais/símbolos viram separador (Nº -> n)
    .toLowerCase()
    .replace(/^\s*\d+(\.\d+)*[.)]\s+/, '') // tira numeração de lista ("2.1.", "3.")
    .replace(/[:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** casa se o texto começa com o rótulo seguido de fronteira (espaço/pontuação/fim) */
function matchLabel(text: string, labels: readonly string[]): boolean {
  const c = norm(text)
  return labels.some((l) => c === l || new RegExp('^' + escapeRe(l) + '(?![a-z0-9])').test(c))
}

type Cell = { text: string; num: number | null; date: Date | null }

function coerce(v: unknown): Cell {
  if (v == null) return { text: '', num: null, date: null }
  if (v instanceof Date) return { text: v.toISOString(), num: null, date: v }
  if (typeof v === 'number') return { text: String(v), num: v, date: null }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('result' in o) return coerce(o.result)
    if ('text' in o) return coerce(o.text)
    if ('richText' in o && Array.isArray(o.richText))
      return coerce((o.richText as { text: string }[]).map((r) => r.text).join(''))
    if ('hyperlink' in o) return coerce(o.hyperlink)
  }
  const s = String(v).trim()
  const n = Number(s.replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return { text: s, num: Number.isFinite(n) && s !== '' ? n : null, date: null }
}

const COUNTRY_ISO2: Record<string, string> = {
  argentina: 'AR', brasil: 'BR', brazil: 'BR', chile: 'CL', colombia: 'CO',
  peru: 'PE', paraguai: 'PY', paraguay: 'PY', uruguai: 'UY', uruguay: 'UY',
  mexico: 'MX', bolivia: 'BO', equador: 'EC', ecuador: 'EC', venezuela: 'VE',
  'estados unidos': 'US', eua: 'US', usa: 'US', espanha: 'ES', portugal: 'PT',
}
const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase())

const PRODUCT_GROUP_KEYWORDS: Array<[RegExp, string]> = [
  [/opgw|fibra/, 'opgw_fibra'],
  [/preformad/, 'preformados'],
  [/cadena|cadeia/, 'cadeias'],
  [/amorti|amortecedor|svd|stockbridge|espacad/, 'svd_amortecedor'],
  [/cruzeta/, 'cruzeta'],
  [/aislador|isolador/, 'isoladores'],
  [/conector/, 'conectores'],
  [/ferragem|ferrag|herraje/, 'ferragens'],
]

function normalizeCurrency(text: string): string {
  const t = norm(text)
  // Códigos exigem fronteira de palavra (evita casar "pen" dentro de palavras);
  // dólar/US$ tem prioridade por ser o caso comum das propostas de exportação.
  if (/\b(brl|reais|real)\b|r\$/.test(t)) return 'BRL'
  if (/\beur\b|€/.test(t)) return 'EUR'
  if (/\b(usd|dolar|dolares|dollar)\b/.test(t) || /us\$/.test(t)) return 'USD'
  if (/\bars\b/.test(t)) return 'ARS'
  if (/\bclp\b/.test(t)) return 'CLP'
  if (/\bcop\b/.test(t)) return 'COP'
  if (/\bpen\b/.test(t)) return 'PEN'
  if (/\bpyg\b/.test(t)) return 'PYG'
  if (/\$/.test(t)) return 'USD'
  return ''
}

function toISO(c: Cell): string | null {
  if (c.date) return c.date.toISOString()
  const s = c.text.trim()
  if (!s) return null
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`).toISOString()
  m = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/) // dd/mm/yyyy
  if (m) {
    const [, d, mo, y] = m
    const yr = y.length === 2 ? `20${y}` : y
    return new Date(`${yr}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`).toISOString()
  }
  return null
}

/** Lê um .xlsx (ArrayBuffer) e devolve a proposta normalizada (não validada). */
export async function parseProposalBuffer(buffer: ArrayBuffer): Promise<ParsedProposal> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Planilha vazia ou ilegível.')

  const grid: Cell[][] = []
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    const arr: Cell[] = []
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      arr[c - 1] = coerce(cell.value)
    })
    grid[r - 1] = arr
  })
  const at = (r: number, c: number): Cell => grid[r]?.[c] ?? { text: '', num: null, date: null }

  /** valor de um rótulo: inline ("label: valor"), à direita, ou abaixo */
  function valueFor(labels: readonly string[], maxRow = grid.length): Cell | null {
    for (let r = 0; r < Math.min(maxRow, grid.length); r++) {
      const row = grid[r] ?? []
      for (let c = 0; c < row.length; c++) {
        const raw = row[c]?.text
        if (!raw || !matchLabel(raw, labels)) continue
        const idx = raw.indexOf(':')
        if (idx >= 0) {
          const after = raw.slice(idx + 1).trim()
          if (after) return coerce(after)
        }
        for (let cc = c + 1; cc < c + 6; cc++) if (at(r, cc).text) return at(r, cc)
        if (at(r + 1, c).text) return at(r + 1, c)
      }
    }
    return null
  }

  // ─── Tabela de itens (detecta o cabeçalho) ───────────────────────────────
  let headerRow = -1
  const colMap: Partial<Record<keyof typeof ITEM_HEADERS, number>> = {}
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? []
    const map: Partial<Record<keyof typeof ITEM_HEADERS, number>> = {}
    for (let c = 0; c < row.length; c++) {
      const txt = row[c]?.text
      if (!txt) continue
      for (const key of Object.keys(ITEM_HEADERS) as (keyof typeof ITEM_HEADERS)[]) {
        if (map[key] === undefined && matchLabel(txt, ITEM_HEADERS[key])) map[key] = c
      }
    }
    if (map.description !== undefined && (map.quantity !== undefined || map.unit_price !== undefined || map.total !== undefined)) {
      headerRow = r
      Object.assign(colMap, map)
      break
    }
  }
  const itemsTop = headerRow >= 0 ? headerRow : grid.length

  const items: ProposalItem[] = []
  let summedTotal = 0
  let grandTotalFromTable: number | null = null
  if (headerRow >= 0) {
    let started = false
    for (let r = headerRow + 1; r < grid.length; r++) {
      const desc = colMap.description !== undefined ? at(r, colMap.description) : { text: '', num: null, date: null }
      const code = colMap.product_code !== undefined ? at(r, colMap.product_code) : null
      const qty = colMap.quantity !== undefined ? at(r, colMap.quantity) : null
      const unit = colMap.unit_price !== undefined ? at(r, colMap.unit_price) : null
      const tot = colMap.total !== undefined ? at(r, colMap.total) : null
      const blank = ![desc.text, code?.text, qty?.num, unit?.num, tot?.num].some((v) => v != null && v !== '')
      if (blank) {
        if (started) break // linha vazia após itens encerra
        continue // pula linhas em branco entre cabeçalho e itens
      }
      const isTotalRow =
        tot?.num != null && qty?.num == null && !code?.text &&
        (!desc.text || matchLabel(desc.text, ['total', 'subtotal', 'total cotizacion', 'total geral', 'valor total', 'importe total']))
      if (isTotalRow) {
        grandTotalFromTable = tot!.num
        continue
      }
      if (!desc.text && !code?.text) continue
      started = true
      items.push({
        product_code: code?.text.trim() || null,
        description: desc.text.trim() || null,
        quantity: qty?.num ?? null,
        unit_price: unit?.num ?? null,
        total: tot?.num ?? null,
      })
      if (tot?.num != null) summedTotal += tot.num
    }
  }

  // ─── Cabeçalho da proposta (campos do cliente ficam ACIMA da tabela) ──────
  let legal_name = valueFor(LABELS.legal_name, itemsTop)?.text.trim() ?? ''
  let countryText = valueFor(LABELS.country, itemsTop)?.text.trim() ?? ''

  // Fallback posicional: bloco do cliente após uma célula "A" (modelo PLP)
  if (!legal_name) {
    let aRow = -1
    for (let r = 0; r < Math.min(itemsTop, 20) && aRow < 0; r++)
      for (let c = 0; c < 5; c++) if (norm(at(r, c).text) === 'a') { aRow = r; break }
    if (aRow >= 0) {
      const lines: string[] = []
      for (let r = aRow + 1; r < itemsTop && lines.length < 2; r++) {
        const t = (grid[r] ?? []).find((x) => x?.text)?.text?.trim()
        if (t) lines.push(t)
      }
      legal_name = lines[0] ?? ''
      if (!countryText && lines[1]) countryText = lines[1]
    }
  }

  // País: detecta um país conhecido em qualquer lugar se ainda não resolvido
  let country_iso2: string | null = COUNTRY_ISO2[norm(countryText)] ?? null
  if (!country_iso2) {
    outer: for (let r = 0; r < Math.min(itemsTop, 25); r++)
      for (const cell of grid[r] ?? []) {
        const n = norm(cell?.text)
        for (const key of Object.keys(COUNTRY_ISO2)) {
          if (new RegExp('\\b' + key + '\\b').test(n)) {
            country_iso2 = COUNTRY_ISO2[key]
            if (!COUNTRY_ISO2[norm(countryText)]) countryText = titleCase(key)
            break outer
          }
        }
      }
  } else {
    countryText = titleCase(countryText)
  }

  const contactName = valueFor(LABELS.contact_name, itemsTop)?.text.trim() ?? ''
  const emailRaw = valueFor(LABELS.email, itemsTop)?.text.trim() ?? ''
  const email = /\S+@\S+\.\S+/.test(emailRaw) ? emailRaw : null
  const phone = valueFor(LABELS.phone, itemsTop)?.text.trim() || null
  const quote_number = valueFor(LABELS.quote_number, itemsTop)?.text.trim() ?? ''

  // Moeda: rótulo (qualquer lugar) ou pistas no texto (US$, dólar…)
  let currency = normalizeCurrency(valueFor(LABELS.currency)?.text ?? '')
  if (!currency) {
    const all = grid.flatMap((row) => (row ?? []).map((c) => c?.text ?? '')).join(' ')
    currency = normalizeCurrency(all) || 'USD'
  }

  // Data: célula de rótulo ou primeiro dd/mm/aaaa do documento
  let received_at = toISO(valueFor(LABELS.product_description) ?? { text: '', num: null, date: null })
  if (!received_at) {
    for (let r = 0; r < grid.length && !received_at; r++)
      for (const c of grid[r] ?? []) {
        const iso = toISO(c)
        if (iso) { received_at = iso; break }
      }
  }
  received_at ||= new Date().toISOString()

  const labelTotal = valueFor(LABELS.total)?.num ?? null
  const total_value = grandTotalFromTable ?? (summedTotal > 0 ? summedTotal : null) ?? labelTotal

  // Inferências
  const haystack = norm(items.map((i) => i.description).join(' '))
  const product_group = PRODUCT_GROUP_KEYWORDS.find(([re]) => re.test(haystack))?.[1] ?? null
  const product_description = items.length
    ? items.map((i) => i.description).filter(Boolean).slice(0, 3).join('; ')
    : null

  return {
    account: { legal_name, country: countryText, country_iso2, segment: null },
    contact: contactName ? { name: contactName, email, phone, role: null } : null,
    quote: {
      quote_number,
      quote_type: 'competitive',
      currency,
      total_value,
      product_group: product_group as ParsedProposal['quote']['product_group'],
      product_description,
      received_at,
      expected_close_at: null,
    },
    items,
  }
}
