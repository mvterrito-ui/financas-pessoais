import { describe, it, expect } from 'vitest'
import {
  emBRL,
  evolucaoBRL,
  variacaoPct,
  type Moeda,
  type WealthSnapshot,
} from './patrimonio.calc'

const rates = { USD: 5, EUR: 6 }

describe('patrimonio.calc', () => {
  it('converte moeda pra real', () => {
    expect(emBRL(10, 'BRL', rates)).toBe(10)
    expect(emBRL(10, 'USD', rates)).toBe(50)
    expect(emBRL(10, 'EUR', rates)).toBe(60)
  })

  it('agrupa por mês já convertido pra real', () => {
    const snaps = [
      { id: 'a', place_id: 'p1', mes: '2026-01-01', valor: 100 }, // BRL
      { id: 'b', place_id: 'p2', mes: '2026-01-01', valor: 10 }, // USD -> 50
      { id: 'c', place_id: 'p1', mes: '2026-02-01', valor: 200 },
    ] as WealthSnapshot[]
    const moeda: Record<string, Moeda> = { p1: 'BRL', p2: 'USD' }
    const serie = evolucaoBRL(snaps, moeda, rates)
    expect(serie).toEqual([
      { mes: '2026-01-01', total: 150 },
      { mes: '2026-02-01', total: 200 },
    ])
  })

  it('variação percentual (e null quando não há base)', () => {
    expect(variacaoPct(110, 100)).toBeCloseTo(10)
    expect(variacaoPct(90, 100)).toBeCloseTo(-10)
    expect(variacaoPct(100, 0)).toBeNull()
  })
})
