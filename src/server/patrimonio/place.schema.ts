import { z } from 'zod'
import { parcial } from '@/server/zod-util'

export const placeCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(60),
  ordem: z.number().int().optional().default(0),
  moeda: z.enum(['BRL', 'USD', 'EUR']).optional().default('BRL'),
})

export const placeUpdateSchema = parcial(placeCreateSchema).extend({
  // Ocultar a partir do mês (AAAA-MM-01) ou null pra mostrar de novo.
  oculto_desde: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, 'Use o formato AAAA-MM-01')
    .nullable()
    .optional(),
})

export type PlaceCreate = z.infer<typeof placeCreateSchema>
export type PlaceUpdate = z.infer<typeof placeUpdateSchema>
