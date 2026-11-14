import { z } from 'zod'
import { parcial } from '@/server/zod-util'

export const fiiCreateSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'Informe o ticker')
    .max(10)
    .transform((s) => s.toUpperCase()),
  quantidade: z.number().min(0),
  preco_medio: z.number().min(0),
})

export const fiiUpdateSchema = parcial(fiiCreateSchema)

export type FiiCreate = z.infer<typeof fiiCreateSchema>
export type FiiUpdate = z.infer<typeof fiiUpdateSchema>
