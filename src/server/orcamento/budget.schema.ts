import { z } from 'zod'
import { parcial } from '@/server/zod-util'

// Uma fatia do orçamento (% das entradas do mês).
export const budgetCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(60),
  percentual: z.number().min(0).max(100),
  ordem: z.number().int().optional().default(0),
})

export const budgetUpdateSchema = parcial(budgetCreateSchema)

export type BudgetCreate = z.infer<typeof budgetCreateSchema>
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>
