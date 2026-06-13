import { describe, it, expect } from 'vitest'
import { rendimento, totais, type FixedIncome } from './renda-fixa.calc'

const item = {
  id: '1',
  nome: 'Tesouro Selic',
  instituicao: 'XP',
  tipo: 'Tesouro',
  valor_aplicado: 1000,
  valor_atual: 1150,
  vencimento: null,
} as FixedIncome

describe('renda-fixa.calc', () => {
  it('rendimento = atual - aplicado', () => {
    expect(rendimento(item)).toBe(150)
  })

  it('totais e retorno', () => {
    const t = totais([item])
    expect(t.aplicado).toBe(1000)
    expect(t.atual).toBe(1150)
    expect(t.resultado).toBe(150)
    expect(t.retorno).toBeCloseTo(15)
  })
})
