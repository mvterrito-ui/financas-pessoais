import { describe, it, expect } from 'vitest'
import { parseStatement, dividirLinha, parseNumero } from './statement'

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

describe('importação: correções de robustez', () => {
  it('duas compras iguais no mesmo arquivo não colidem (sufixo #2), de forma determinística', () => {
    const csv = 'data;descricao;valor\n01/11/2026;Uber;15,90\n01/11/2026;Uber;15,90\n'
    const a = parseStatement(csv).itens.map((i) => i.external_id)
    const b = parseStatement(csv).itens.map((i) => i.external_id)
    expect(a).toHaveLength(2)
    expect(new Set(a).size).toBe(2)
    expect(a[1]).toMatch(/#2$/)
    expect(b).toEqual(a) // reimportar o mesmo arquivo gera os mesmos ids
  })

  it('CSV respeita aspas (vírgula dentro da descrição)', () => {
    expect(dividirLinha('01/11/2026,"Padaria, centro",12.50', ',')).toEqual([
      '01/11/2026',
      'Padaria, centro',
      '12.50',
    ])
    expect(dividirLinha('"diz ""oi""";1', ';')).toEqual(['diz "oi"', '1'])
  })

  it('número: milhar BR com ponto, decimal com vírgula ou ponto', () => {
    expect(parseNumero('1.234')).toBe(1234)
    expect(parseNumero('1.234.567')).toBe(1234567)
    expect(parseNumero('1.234,56')).toBe(1234.56)
    expect(parseNumero('12.50')).toBe(12.5)
    expect(parseNumero('-15,90')).toBe(-15.9)
  })
})
