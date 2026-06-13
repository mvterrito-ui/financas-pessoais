import { z } from 'zod'

// Categoria: Salário, Mercado, Faculdade... Cada uma é de entrada OU de saída.
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(80),
  tipo: z.enum(['entrada', 'saida']),
})

export const categoryUpdateSchema = categoryCreateSchema.partial()

export type CategoryCreate = z.infer<typeof categoryCreateSchema>
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>
