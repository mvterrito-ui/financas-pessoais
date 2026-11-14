import { describe, it, expect } from 'vitest'
import { hojeISO } from './utils'

describe('hojeISO', () => {
  it('usa a data de Brasília, não UTC', () => {
    // 01/12 01:30 UTC = 30/11 22:30 em Brasília
    expect(hojeISO(new Date('2026-12-01T01:30:00Z'))).toBe('2026-11-30')
    expect(hojeISO(new Date('2026-12-01T03:30:00Z'))).toBe('2026-12-01')
  })
})
