import { z } from 'zod'

// Um item já parseado, pronto pra virar lançamento.
// Data de verdade (20261345 do OFX passava no regex e quebrava no banco).
const dataValida = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Data inválida')

export const statementItemSchema = z.object({
  data: dataValida,
  valor: z.number().positive(),
  tipo: z.enum(['entrada', 'saida']),
  descricao: z.string().max(200),
  external_id: z.string().max(200).optional().nullable(),
})

export const statementImportSchema = z.object({
  budget_id: z.string().uuid().optional().nullable(),
  itens: z.array(statementItemSchema).min(1, 'Nada pra importar').max(5000, 'Arquivo grande demais (máx. 5000 lançamentos)'),
})

export type StatementImport = z.infer<typeof statementImportSchema>
