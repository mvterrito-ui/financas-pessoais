import { describe, it, expect } from 'vitest'
import {
  totalEntradas,
  totalSaidas,
  saldo,
  formatBRL,
  addMeses,
  gerarParcelas,
  type Transaction,
} from './fluxo.calc'

const txs = [
  { tipo: 'entrada', valor: 100 },
  { tipo: 'saida', valor: 30 },
  { tipo: 'saida', valor: '20' }, // numeric do Postgres pode vir string
] as Transaction[]

describe('fluxo.calc', () => {
  it('soma entradas, saídas e saldo (aceita string)', () => {
    expect(totalEntradas(txs)).toBe(100)
    expect(totalSaidas(txs)).toBe(50)
    expect(saldo(txs)).toBe(50)
  })

  it('lista vazia => tudo zero', () => {
    expect(saldo([])).toBe(0)
  })

  it('formata em real', () => {
    expect(formatBRL(1234.5)).toContain('1.234,50')
  })
})

describe('parcelamento', () => {
  it('addMeses avança o mês e não estoura o dia (31/01 -> 28/02)', () => {
    expect(addMeses('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMeses('2026-01-31', 1)).toBe('2026-02-28') // fev não tem 31
    expect(addMeses('2026-12-10', 1)).toBe('2027-01-10') // vira o ano
    expect(addMeses('2026-06-09', 0)).toBe('2026-06-09')
  })

  it('divide certinho quando dá exato (1200 em 12x = 100 cada)', () => {
    const ps = gerarParcelas(1200, 12, '2026-06-09')
    expect(ps).toHaveLength(12)
    expect(ps.every((p) => p.valor === 100)).toBe(true)
    expect(ps[0]).toMatchObject({ num: 1, data: '2026-06-09', valor: 100 })
    expect(ps[11]).toMatchObject({ num: 12, data: '2027-05-09' })
  })

  it('joga a sobra de centavos na última parcela (100 em 3x)', () => {
    const ps = gerarParcelas(100, 3, '2026-06-09')
    expect(ps.map((p) => p.valor)).toEqual([33.33, 33.33, 33.34])
    const soma = ps.reduce((s, p) => s + p.valor, 0)
    expect(soma).toBeCloseTo(100, 2) // soma das parcelas = total exato
  })
})
