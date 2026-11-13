import { describe, it, expect } from 'vitest'
import { mesAtualBR } from './patrimonio.calc'

describe('mesAtualBR', () => {
  it('usa o horário de Brasília, não UTC', () => {
    // 01/12 01:00 UTC = 30/11 22:00 em Brasília -> ainda novembro
    expect(mesAtualBR(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11-01')
    // 01/12 03:00 UTC = 01/12 00:00 em Brasília -> dezembro
    expect(mesAtualBR(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12-01')
  })
})
