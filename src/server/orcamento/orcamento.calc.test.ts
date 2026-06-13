import { describe, it, expect } from 'vitest'
import { alocar, somaPercentual, type BudgetBucket } from './orcamento.calc'

const buckets = [
  { id: '1', name: 'Geral', percentual: 50, ordem: 1 },
  { id: '2', name: 'Reserva', percentual: '10', ordem: 2 },
] as BudgetBucket[]

describe('orcamento.calc', () => {
  it('aloca renda por percentual (aceita string)', () => {
    const a = alocar(1000, buckets)
    expect(a[0].valor).toBe(500)
    expect(a[1].valor).toBe(100)
  })

  it('renda zero => tudo zero', () => {
    expect(alocar(0, buckets).every((b) => b.valor === 0)).toBe(true)
  })

  it('soma os percentuais', () => {
    expect(somaPercentual(buckets)).toBe(60)
  })
})
