import { z } from 'zod'

export const fixedIncomeCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome').max(80),
  instituicao: z.string().trim().max(80).optional().nullable(),
  tipo: z.string().trim().max(40).optional().nullable(),
  valor_aplicado: z.number().min(0).optional().default(0),
  valor_atual: z.number().min(0).optional().default(0),
  vencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD')
    .optional()
    .nullable(),
})

export const fixedIncomeUpdateSchema = fixedIncomeCreateSchema.partial()

export type FixedIncomeCreate = z.infer<typeof fixedIncomeCreateSchema>
export type FixedIncomeUpdate = z.infer<typeof fixedIncomeUpdateSchema>
