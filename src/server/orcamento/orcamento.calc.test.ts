import { describe, it, expect } from 'vitest'
import { alocar, somaPercentual, usoPorFatia, type BudgetBucket } from './orcamento.calc'

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

describe('usoPorFatia', () => {
  const fatias = [{ id: '1' }, { id: '2' }]
  const emReal = (v: number | string, m?: string | null) => Number(v) * (m === 'USD' ? 5 : 1)

  it('soma as saídas de cada fatia (convertendo moeda)', () => {
    const { porFatia, semFatia } = usoPorFatia(
      [
        { valor: 100, budget_id: '1' },
        { valor: '50', budget_id: '1' },
        { valor: 10, moeda: 'USD', budget_id: '2' },
      ],
      fatias,
      emReal,
    )
    expect(porFatia.get('1')).toBe(150)
    expect(porFatia.get('2')).toBe(50)
    expect(semFatia).toBe(0)
  })

  it('sem fatia ou fatia fora da lista vai pra semFatia', () => {
    const { porFatia, semFatia } = usoPorFatia(
      [
        { valor: 20, budget_id: null },
        { valor: 5, budget_id: 'removida' },
      ],
      fatias,
      emReal,
    )
    expect(porFatia.size).toBe(0)
    expect(semFatia).toBe(25)
  })
})
