import { describe, it, expect } from 'vitest'
import { mesAtualBR, visivelNoMes } from './patrimonio.calc'

describe('mesAtualBR', () => {
  it('usa o horário de Brasília, não UTC', () => {
    // 01/12 01:00 UTC = 30/11 22:00 em Brasília -> ainda novembro
    expect(mesAtualBR(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11-01')
    // 01/12 03:00 UTC = 01/12 00:00 em Brasília -> dezembro
    expect(mesAtualBR(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12-01')
  })
})

describe('visivelNoMes', () => {
  it('sem oculto_desde: sempre visível', () => {
    expect(visivelNoMes({ oculto_desde: null }, '2026-11-01')).toBe(true)
  })
  it('oculto a partir de nov: out aparece, nov e dez não', () => {
    const p = { oculto_desde: '2026-11-01' }
    expect(visivelNoMes(p, '2026-10-01')).toBe(true)
    expect(visivelNoMes(p, '2026-11-01')).toBe(false)
    expect(visivelNoMes(p, '2026-12-01')).toBe(false)
  })
})
