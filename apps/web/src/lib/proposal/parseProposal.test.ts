import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseProposalBuffer } from './parseProposal'

// Gera um .xlsx em memória no formato esperado e valida a extração.
// Serve também como documentação viva do layout que o parser entende.
async function makeWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Proposta')
  ws.addRow(['Cliente:', 'Elecnor Chile S.A.'])
  ws.addRow(['País:', 'Chile'])
  ws.addRow(['Contato:', 'María González'])
  ws.addRow(['E-mail:', 'maria@elecnor.cl'])
  ws.addRow(['Proposta Nº:', 'EXP-2025-0420'])
  ws.addRow(['Moeda:', 'USD'])
  ws.addRow(['Data:', new Date('2025-03-10T12:00:00Z')])
  ws.addRow([])
  ws.addRow(['Código', 'Descrição', 'Qtd', 'Preço Unit.', 'Total'])
  ws.addRow(['OPGW-48', 'Cabo OPGW 48 fibras', 1000, 12.5, 12500])
  ws.addRow(['FER-230', 'Ferragens 230kV', 50, 80, 4000])
  ws.addRow(['', 'TOTAL', '', '', 16500])
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

describe('parseProposalBuffer', () => {
  it('extrai cabeçalho, itens e total de uma proposta padrão', async () => {
    const buf = await makeWorkbook()
    const p = await parseProposalBuffer(buf)

    expect(p.account.legal_name).toBe('Elecnor Chile S.A.')
    expect(p.account.country).toBe('Chile')
    expect(p.account.country_iso2).toBe('CL') // inferido do nome do país
    expect(p.contact?.name).toBe('María González')
    expect(p.contact?.email).toBe('maria@elecnor.cl')
    expect(p.quote.quote_number).toBe('EXP-2025-0420')
    expect(p.quote.currency).toBe('USD')
    expect(p.quote.product_group).toBe('opgw_fibra') // inferido da descrição
    expect(p.items).toHaveLength(2)
    expect(p.items[0]).toMatchObject({ product_code: 'OPGW-48', quantity: 1000, unit_price: 12.5, total: 12500 })
    expect(p.quote.total_value).toBe(16500) // linha de TOTAL da tabela
  })

  it('entende o modelo comercial de exportação (espanhol, cliente posicional, numeração)', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Proposta')
    ws.getCell('C4').value = 'PROPUESTA COMERCIAL'
    ws.getCell('C6').value = 'A'
    ws.getCell('N6').value = 'Cajamar, 02 de Junio de 2026.'
    ws.getCell('C7').value = 'RTHO ELEKTRISCHE SPA'
    ws.getCell('C8').value = 'SANTIAGO, CHILE'
    ws.getCell('C10').value = 'Atn:'
    ws.getCell('D10').value = 'Sr. Juan Pérez'
    ws.getCell('C11').value = 'Nº Ref.:'
    ws.getCell('D11').value = '79583'
    ws.getCell('C12').value = 'Asunto:'
    ws.getCell('D12').value = 'Su solicitud E-mail, de 02/06/2026'
    ws.getCell('C16').value = '1. Planilla de precios'
    ws.getCell('C18').value = 'Ítem'
    ws.getCell('D18').value = 'Referencia'
    ws.getCell('E18').value = 'Descripción'
    ws.getCell('F18').value = 'Un'
    ws.getCell('G18').value = 'Cantidad'
    ws.getCell('H18').value = 'Precio Un. (US$)'
    ws.getCell('I18').value = 'Precio Total (US$)'
    // linha 19 fica em branco de propósito (como no modelo real)
    ws.getCell('C20').value = '0001'
    ws.getCell('D20').value = '@CAU0230387AMN0'
    ws.getCell('E20').value = 'CADENA ANCLAJE 2CB E=300mm JESSAMINE'
    ws.getCell('F20').value = 'UN'
    ws.getCell('G20').value = 6
    ws.getCell('H20').value = 280
    ws.getCell('I20').value = 1680
    ws.getCell('C21').value = '0002'
    ws.getCell('D21').value = '@CSU0230387AMN0'
    ws.getCell('E21').value = 'CADENA SUSP "I" 2CB E=300mm'
    ws.getCell('F21').value = 'UN'
    ws.getCell('G21').value = 6
    ws.getCell('H21').value = 160
    ws.getCell('I21').value = 960
    ws.getCell('F27').value = 'Total Cotización(US$)'
    ws.getCell('I27').value = 2640
    ws.getCell('C30').value = '2.1. Moneda de cotización: Dolares Estadunidenses.'
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer

    const p = await parseProposalBuffer(buf)
    expect(p.account.legal_name).toBe('RTHO ELEKTRISCHE SPA') // bloco posicional após "A"
    expect(p.account.country_iso2).toBe('CL') // detectado de "SANTIAGO, CHILE"
    expect(p.contact?.name).toBe('Sr. Juan Pérez') // rótulo "Atn:"
    expect(p.quote.quote_number).toBe('79583') // "Nº Ref.:"
    expect(p.quote.currency).toBe('USD') // apesar do prefixo "2.1." e de palavras com "pen"
    expect(p.quote.product_group).toBe('cadeias') // CADENA -> cadeias
    expect(p.items).toHaveLength(2) // pula a linha em branco após o cabeçalho
    expect(p.items[0].product_code).toBe('@CAU0230387AMN0')
    expect(p.quote.total_value).toBe(2640)
    expect(new Date(p.quote.received_at).toISOString().slice(0, 10)).toBe('2026-06-02')
  })

  it('cai para a data de hoje quando a planilha não traz data', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('P')
    ws.addRow(['Cliente:', 'YPF'])
    ws.addRow(['País:', 'Argentina'])
    ws.addRow(['Proposta:', 'X-1'])
    ws.addRow(['Descrição', 'Qtd', 'Total'])
    ws.addRow(['Preformados', 10, 5000])
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
    const p = await parseProposalBuffer(buf)
    expect(p.account.country_iso2).toBe('AR')
    expect(p.quote.total_value).toBe(5000)
    expect(new Date(p.quote.received_at).getFullYear()).toBeGreaterThanOrEqual(2025)
  })
})
