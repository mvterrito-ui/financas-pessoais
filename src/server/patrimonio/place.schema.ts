import { z } from 'zod'

export const placeCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(60),
  ordem: z.number().int().optional().default(0),
  moeda: z.enum(['BRL', 'USD', 'EUR']).optional().default('BRL'),
})

export const placeUpdateSchema = placeCreateSchema.partial()

export type PlaceCreate = z.infer<typeof placeCreateSchema>
export type PlaceUpdate = z.infer<typeof placeUpdateSchema>
