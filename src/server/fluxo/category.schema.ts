import { z } from 'zod'
import { parcial } from '@/server/zod-util'

// Categoria: Salário, Mercado, Faculdade... Cada uma é de entrada OU de saída.
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(80),
  tipo: z.enum(['entrada', 'saida']),
})

export const categoryUpdateSchema = parcial(categoryCreateSchema).extend({
  // Ligação com o Controle Anual (null = desliga).
  annual_item_id: z.string().uuid().nullable().optional(),
})

export type CategoryCreate = z.infer<typeof categoryCreateSchema>
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>
