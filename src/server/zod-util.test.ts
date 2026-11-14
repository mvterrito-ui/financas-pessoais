import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parcial } from './zod-util'

describe('parcial', () => {
  const criar = z.object({
    nome: z.string(),
    aplicado: z.number().optional().default(0),
    atual: z.number().optional().default(0),
    moeda: z.enum(['BRL', 'USD']).optional().default('BRL'),
  })

  it('não preenche defaults nos campos ausentes (não zera o que não veio)', () => {
    expect(parcial(criar).parse({ aplicado: 5 })).toEqual({ aplicado: 5 })
    expect(parcial(criar).parse({ moeda: 'USD' })).toEqual({ moeda: 'USD' })
  })

  it('o .partial() puro tem o problema (documenta o porquê do helper)', () => {
    expect(criar.partial().parse({ aplicado: 5 })).toEqual({ aplicado: 5, atual: 0, moeda: 'BRL' })
  })

  it('continua validando os campos enviados', () => {
    expect(() => parcial(criar).parse({ aplicado: 'x' })).toThrow()
  })
})
