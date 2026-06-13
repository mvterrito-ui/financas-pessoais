import { z } from 'zod'

// Um item já parseado, pronto pra virar lançamento.
export const statementItemSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.number().positive(),
  tipo: z.enum(['entrada', 'saida']),
  descricao: z.string().max(200),
  external_id: z.string().max(200).optional().nullable(),
})

export const statementImportSchema = z.object({
  account_id: z.string().uuid().optional().nullable(),
  itens: z.array(statementItemSchema).min(1, 'Nada pra importar'),
})

export type StatementImport = z.infer<typeof statementImportSchema>
