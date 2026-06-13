import { z } from 'zod'

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

export const fiiUpdateSchema = fiiCreateSchema.partial()

export type FiiCreate = z.infer<typeof fiiCreateSchema>
export type FiiUpdate = z.infer<typeof fiiUpdateSchema>
