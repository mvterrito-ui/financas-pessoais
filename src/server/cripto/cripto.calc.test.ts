import { describe, it, expect } from 'vitest'
import { retornoPct, totais, somaItens, type CryptoSummary, type CryptoItem } from './cripto.calc'

describe('cripto.calc', () => {
  it('retorno percentual (null sem aplicado)', () => {
    expect(retornoPct(1000, 100)).toBeCloseTo(10)
    expect(retornoPct(0, 100)).toBeNull()
  })

  it('totais somam aplicado e resultado (com prejuízo)', () => {
    const linhas = [
      { id: '1', exchange: 'BINANCE', ano: 2026, aplicado: 660, resultado: -538 },
      { id: '2', exchange: 'GATE', ano: 2026, aplicado: 95, resultado: 76 },
    ] as CryptoSummary[]
    const t = totais(linhas)
    expect(t.aplicado).toBe(755)
    expect(t.resultado).toBe(-462)
  })

  it('soma os itens do detalhamento', () => {
    const itens = [
      { id: '1', summary_id: 's', label: 'TRADE', valor: 2980, ordem: 1 },
      { id: '2', summary_id: 's', label: 'HOLD', valor: '200', ordem: 2 },
    ] as CryptoItem[]
    expect(somaItens(itens)).toBe(3180)
  })
})
