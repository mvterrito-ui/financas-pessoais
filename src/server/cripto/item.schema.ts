import { z } from 'zod'

export const itemCreateSchema = z.object({
  summary_id: z.string().uuid(),
  label: z.string().trim().min(1, 'Informe um nome').max(60),
  valor: z.number().optional().default(0),
  ordem: z.number().int().optional().default(0),
})

export const itemUpdateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  valor: z.number().optional(),
  ordem: z.number().int().optional(),
})

export type ItemCreate = z.infer<typeof itemCreateSchema>
export type ItemUpdate = z.infer<typeof itemUpdateSchema>
