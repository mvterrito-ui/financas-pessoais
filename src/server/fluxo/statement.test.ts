import { describe, it, expect } from 'vitest'
import { parseStatement } from './statement'

const ofx = `OFXHEADER:100
<OFX><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260515120000<TRNAMT>-123.45<FITID>X1<MEMO>SUPERMERCADO</STMTTRN>
<STMTTRN><DTPOSTED>20260520<TRNAMT>500.00<FITID>X2<MEMO>PAGAMENTO</STMTTRN>
</BANKTRANLIST></OFX>`

const csv = `date,title,amount
2026-05-15,Supermercado,123.45
2026-05-20,Estorno,-50,00`

describe('statement parser', () => {
  it('OFX: datas, sinais e FITID', () => {
    const { formato, itens } = parseStatement(ofx)
    expect(formato).toBe('OFX')
    expect(itens).toHaveLength(2)
    expect(itens[0]).toMatchObject({
      data: '2026-05-15',
      valor: 123.45,
      tipo: 'saida', // negativo = gasto
      external_id: 'X1',
    })
    expect(itens[1]).toMatchObject({ tipo: 'entrada', valor: 500 })
  })

  it('CSV: positivo = gasto, negativo = entrada (e vírgula decimal)', () => {
    const { formato, itens } = parseStatement(csv)
    expect(formato).toBe('CSV')
    expect(itens[0]).toMatchObject({ data: '2026-05-15', valor: 123.45, tipo: 'saida' })
    expect(itens[1]).toMatchObject({ valor: 50, tipo: 'entrada' })
  })
})
