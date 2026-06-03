/**
 * Parser determinístico de proposta em Excel (.xlsx).
 *
 * Estratégia: dirigida por RÓTULOS e CABEÇALHOS (não por coordenadas fixas), o
 * que tolera pequenas variações de layout. Os mapas de rótulo abaixo são o
 * único ponto a ajustar para casar com o seu modelo de planilha.
 *
 * A planilha NÃO é persistida — só é lida em memória para alimentar o cadastro.
 */
import type { ParsedProposal, ProposalItem } from '@crm-plp/shared'

// ─── Mapas de rótulo (ajuste aqui para o seu modelo) ──────────────────────────
export const LABELS = {
  legal_name: ['cliente', 'client', 'empresa', 'razao social', 'customer', 'comprador'],
  country: ['pais', 'country', 'destino'],
  contact_name: ['contato', 'contact', 'atencion', 'att', 'a/c', 'responsavel'],
  email: ['email', 'e-mail', 'correo'],
  phone: ['telefone', 'fone', 'phone', 'tel', 'celular', 'whatsapp'],
  quote_number: ['proposta', 'cotacao', 'quote', 'numero', 'no', 'n', 'referencia', 'ref', 'oferta', 'orcamento'],
  currency: ['moeda', 'currency', 'divisa'],
  received_at: ['data', 'date', 'fecha', 'emissao'],
  expected_close_at: ['validade', 'valido ate', 'valid', 'vencimento', 'validez'],
  total: ['valor total', 'total geral', 'total da proposta', 'total', 'importe total', 'grand total'],
  product_description: ['objeto', 'descricao da proposta', 'assunto', 'projeto', 'obra'],
} as const

const ITEM_HEADERS = {
  product_code: ['codigo', 'code', 'cod', 'item', 'ref', 'sku', 'part number', 'pn'],
  description: ['descricao', 'descripcion', 'description', 'produto', 'product', 'detalhe'],
  quantity: ['qtd', 'quant', 'quantidade', 'cantidad', 'quantity', 'qty'],
  unit_price: ['preco unit', 'valor unit', 'unit price', 'p unit', 'precio', 'preco unitario', 'unitario'],
  total: ['total', 'subtotal', 'valor total', 'importe', 'amount'],
} as const

// ─── Normalização ─────────────────────────────────────────────────────────────
const DIACRITICS = /[̀-ͯ]/g
function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '') // remove acentos (diacríticos combinantes)
    .toLowerCase()
    .replace(/[:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

const PRODUCT_GROUP_KEYWORDS: Array<[RegExp, string]> = [
  [/opgw|fibra/, 'opgw_fibra'],
  [/preformad/, 'preformados'],
  [/cadeia|isolad.*cadeia/, 'cadeias'],
  [/amortecedor|svd|stockbridge|espacad/, 'svd_amortecedor'],
  [/cruzeta/, 'cruzeta'],
  [/isolador/, 'isoladores'],
  [/conector/, 'conectores'],
  [/ferragem|ferrag/, 'ferragens'],
]

function normalizeCurrency(text: string): string {
  const t = norm(text)
  if (/brl|r\$|real|reais/.test(t)) return 'BRL'
  if (/eur|€/.test(t)) return 'EUR'
  if (/ars/.test(t)) return 'ARS'
  if (/clp/.test(t)) return 'CLP'
  if (/cop/.test(t)) return 'COP'
  if (/pen/.test(t)) return 'PEN'
  if (/pyg/.test(t)) return 'PYG'
  if (/usd|us\$|dolar|\$/.test(t)) return 'USD'
  return ''
}

function toISODate(c: Cell): string | null {
  if (c.date) return c.date.toISOString()
  const s = c.text.trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`).toISOString()
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/) // dd/mm/yyyy
  if (m) {
    const [, d, mo, y] = m
    const yr = y.length === 2 ? `20${y}` : y
    return new Date(`${yr}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`).toISOString()
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function matchLabel(cellText: string, labels: readonly string[]): boolean {
  const c = norm(cellText)
  return labels.some((l) => c === l || c.startsWith(l + ' ') || c === l + '.')
}

/** Lê um .xlsx (ArrayBuffer) e devolve a proposta normalizada (não validada). */
export async function parseProposalBuffer(buffer: ArrayBuffer): Promise<ParsedProposal> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Planilha vazia ou ilegível.')

  // matriz 0-based de células
  const grid: Cell[][] = []
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    const arr: Cell[] = []
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      arr[c - 1] = coerce(cell.value)
    })
    grid[r - 1] = arr
  })

  const at = (r: number, c: number): Cell => grid[r]?.[c] ?? { text: '', num: null, date: null }

  /** valor adjacente (direita, senão abaixo) ao primeiro rótulo encontrado */
  function valueFor(labels: readonly string[]): Cell | null {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] ?? []
      for (let c = 0; c < row.length; c++) {
        if (!row[c]?.text) continue
        if (matchLabel(row[c].text, labels)) {
          for (let cc = c + 1; cc < c + 6; cc++) if (at(r, cc).text) return at(r, cc)
          if (at(r + 1, c).text) return at(r + 1, c)
        }
      }
    }
    return null
  }

  // ─── Cabeçalho da proposta ───────────────────────────────────────────────
  const legal_name = valueFor(LABELS.legal_name)?.text.trim() ?? ''
  const countryText = valueFor(LABELS.country)?.text.trim() ?? ''
  const contactName = valueFor(LABELS.contact_name)?.text.trim() ?? ''
  const email = valueFor(LABELS.email)?.text.trim() || null
  const phone = valueFor(LABELS.phone)?.text.trim() || null
  const quote_number = valueFor(LABELS.quote_number)?.text.trim() ?? ''
  const currency = normalizeCurrency(valueFor(LABELS.currency)?.text ?? '') || 'USD'
  const received_at = toISODate(valueFor(LABELS.received_at) ?? { text: '', num: null, date: null }) ?? new Date().toISOString()
  const expected_close_at = toISODate(valueFor(LABELS.expected_close_at) ?? { text: '', num: null, date: null })
  const objetoDesc = valueFor(LABELS.product_description)?.text.trim() || null

  // ─── Tabela de itens ─────────────────────────────────────────────────────
  let headerRow = -1
  let colMap: Partial<Record<keyof typeof ITEM_HEADERS, number>> = {}
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
      colMap = map
      break
    }
  }

  const items: ProposalItem[] = []
  let summedTotal = 0
  let grandTotalFromTable: number | null = null
  if (headerRow >= 0) {
    for (let r = headerRow + 1; r < grid.length; r++) {
      const desc = colMap.description !== undefined ? at(r, colMap.description) : { text: '', num: null, date: null }
      const code = colMap.product_code !== undefined ? at(r, colMap.product_code) : null
      const qty = colMap.quantity !== undefined ? at(r, colMap.quantity) : null
      const unit = colMap.unit_price !== undefined ? at(r, colMap.unit_price) : null
      const tot = colMap.total !== undefined ? at(r, colMap.total) : null
      const anyVal = [desc.text, code?.text, qty?.num, unit?.num, tot?.num].some((v) => v != null && v !== '')
      if (!anyVal) break // linha em branco encerra a tabela
      // linha de total (descrição vazia OU literal "Total/Subtotal", sem qtd) → grand total, não item
      const isTotalRow =
        tot?.num != null &&
        (qty?.num == null) &&
        !code?.text &&
        (!desc.text || matchLabel(desc.text, ['total', 'subtotal', 'total geral', 'valor total', 'importe total', 'total da proposta']))
      if (isTotalRow) {
        grandTotalFromTable = tot!.num
        continue
      }
      if (!desc.text && code?.text == null) continue
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

  // Preferir o total derivado da tabela (linha de total ou soma dos itens);
  // o rótulo solto "Total" pode colidir com o cabeçalho da tabela de itens.
  const labelTotal = valueFor(LABELS.total)?.num ?? null
  const total_value = grandTotalFromTable ?? (summedTotal > 0 ? summedTotal : null) ?? labelTotal

  // ─── Inferências ──────────────────────────────────────────────────────────
  const haystack = norm([objetoDesc, ...items.map((i) => i.description)].join(' '))
  const product_group = PRODUCT_GROUP_KEYWORDS.find(([re]) => re.test(haystack))?.[1] ?? null
  const country_iso2 = COUNTRY_ISO2[norm(countryText)] ?? null
  const product_description =
    objetoDesc ?? (items.length ? items.map((i) => i.description).filter(Boolean).slice(0, 3).join('; ') : null)

  return {
    account: {
      legal_name,
      country: countryText,
      country_iso2,
      segment: null,
    },
    contact: contactName ? { name: contactName, email, phone, role: null } : null,
    quote: {
      quote_number,
      quote_type: 'competitive',
      currency,
      total_value,
      product_group: product_group as ParsedProposal['quote']['product_group'],
      product_description,
      received_at,
      expected_close_at,
    },
    items,
  }
}
