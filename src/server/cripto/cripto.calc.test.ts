import { describe, it, expect } from 'vitest'
import { retornoPct, totais, somaItens, valorAtual, aoEditar, valorAtualLinha, type CryptoSummary, type CryptoItem } from './cripto.calc'

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

describe('cripto.valorAtual', () => {

  it('sem dados => 0', () => {
    expect(valorAtual([])).toBe(0)
  })

  it('por corretora, usa o ano mais recente DELA: aplicado + resultado', () => {
    const c = (exchange: string, ano: number, aplicado: number, resultado: number) =>
      ({ id: `${exchange}${ano}`, exchange, ano, aplicado, resultado }) as CryptoSummary
    const itens = [c('A', 2025, 1000, 500), c('A', 2026, 2000, 300), c('B', 2025, 1000, -100)]
    // A: 2026 (2300) · B ainda sem 2026 -> usa 2025 (900)
    expect(valorAtual(itens)).toBe(3200)
  })
})

describe('cripto.aoEditar (valor atual -> lucro automático)', () => {
  const linha = { aplicado: 1000, resultado: 200 } // vale 1200 hoje

  it('editar o valor atual recalcula o lucro', () => {
    expect(aoEditar(linha, 'atual', 900)).toEqual({ aplicado: 1000, resultado: -100 })
  })

  it('editar o aplicado mantém o valor atual e ajusta o lucro', () => {
    expect(aoEditar(linha, 'aplicado', 1100)).toEqual({ aplicado: 1100, resultado: 100 })
  })

  it('linha nova: aplicado vira também o valor atual (lucro 0)', () => {
    expect(aoEditar(undefined, 'aplicado', 500)).toEqual({ aplicado: 500, resultado: 0 })
  })

  it('valorAtualLinha = aplicado + resultado', () => {
    expect(valorAtualLinha({ aplicado: '1000', resultado: '-250' })).toBe(750)
  })
})
