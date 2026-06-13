import { describe, it, expect } from 'vitest'
import {
  mesesEntre,
  taxaMensalHistorica,
  mensalParaAnual,
  projetar,
} from './projecao.calc'

describe('projecao.calc', () => {
  it('mesesEntre conta ano+mês', () => {
    expect(mesesEntre('2026-01-01', '2026-01-01')).toBe(0)
    expect(mesesEntre('2025-01-01', '2026-03-01')).toBe(14)
  })

  it('taxaMensalHistorica: dobrar em 12 meses = ~5,95% ao mês', () => {
    const serie = [
      { mes: '2025-01-01', total: 1000 },
      { mes: '2026-01-01', total: 2000 },
    ]
    expect(taxaMensalHistorica(serie)).toBeCloseTo(Math.pow(2, 1 / 12) - 1, 6)
  })

  it('taxaMensalHistorica: null quando não dá pra calcular', () => {
    expect(taxaMensalHistorica([{ mes: '2026-01-01', total: 1000 }])).toBeNull()
    expect(
      taxaMensalHistorica([
        { mes: '2025-01-01', total: 0 },
        { mes: '2026-01-01', total: 1000 },
      ]),
    ).toBeNull()
  })

  it('mensalParaAnual: 1% ao mês ≈ 12,68% ao ano', () => {
    expect(mensalParaAnual(0.01)).toBeCloseTo(0.1268, 4)
  })

  it('projetar: 1% ao mês, sem aporte -> ~+12,68% no 1º ano', () => {
    const p = projetar(1000, 0.01, 0, 1)
    expect(p[0]).toMatchObject({ ano: 0, valor: 1000 })
    expect(p[1].ano).toBe(1)
    expect(p[1].valor).toBeCloseTo(1126.83, 1) // 1000 * 1.01^12
    expect(p[1].aportado).toBe(0)
  })

  it('projetar: taxa 0 vira só a soma dos aportes', () => {
    const p = projetar(1000, 0, 100, 2)
    expect(p).toHaveLength(3) // ano 0, 1, 2
    expect(p[2].aportado).toBe(2400) // 100 x 24 meses
    expect(p[2].valor).toBeCloseTo(3400, 6) // 1000 inicial + 2400 aportados
    expect(p[2].semAporte).toBe(1000) // sem juros, sem aporte, fica igual
  })
})
