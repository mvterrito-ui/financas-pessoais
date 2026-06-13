import { describe, it, expect } from 'vitest'
import { investido, valorAtual, lucro, totais, type Fii } from './fii.calc'

const fii = { id: '1', ticker: 'BTLG11', quantidade: 10, preco_medio: 100 } as Fii

describe('fii.calc', () => {
  it('investido = cotas x preço médio', () => {
    expect(investido(fii)).toBe(1000)
  })

  it('sem cotação => valor atual cai pro investido (lucro 0)', () => {
    expect(valorAtual(fii, {})).toBe(1000)
    expect(lucro(fii, {})).toBe(0)
  })

  it('com cotação => valor e lucro reais', () => {
    const quotes = { BTLG11: 120 }
    expect(valorAtual(fii, quotes)).toBe(1200)
    expect(lucro(fii, quotes)).toBe(200)
  })

  it('totais agregam vários FIIs', () => {
    const fiis = [fii, { id: '2', ticker: 'MXRF11', quantidade: 100, preco_medio: 10 }] as Fii[]
    const t = totais(fiis, { BTLG11: 120, MXRF11: 9 })
    expect(t.aplicado).toBe(2000) // 1000 + 1000
    expect(t.atual).toBe(2100) // 1200 + 900
    expect(t.resultado).toBe(100)
    expect(t.retorno).toBeCloseTo(5)
  })
})
