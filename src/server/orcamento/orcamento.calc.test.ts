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
  const contas = [
    { id: 'nubank', budget_id: '1' },
    { id: 'inter', budget_id: '1' },
    { id: 'xp', budget_id: null },
  ]
  const dobro = (v: number | string, m?: string | null) => Number(v) * (m === 'USD' ? 5 : 1)

  it('soma as saídas das contas de cada fatia (convertendo moeda)', () => {
    const { porFatia, semFatia } = usoPorFatia(
      [
        { valor: 100, account_id: 'nubank' },
        { valor: '50', account_id: 'inter' },
        { valor: 10, moeda: 'USD', account_id: 'inter' },
      ],
      contas,
      dobro,
    )
    expect(porFatia.get('1')).toBe(200)
    expect(semFatia).toBe(0)
  })

  it('sem conta ou conta sem fatia vai pra semFatia', () => {
    const { porFatia, semFatia } = usoPorFatia(
      [
        { valor: 30, account_id: 'xp' },
        { valor: 20, account_id: null },
        { valor: 5, account_id: 'apagada' },
      ],
      contas,
      dobro,
    )
    expect(porFatia.size).toBe(0)
    expect(semFatia).toBe(55)
  })
})
