import { z } from 'zod'

// Campos crus de um lançamento (sem regras cruzadas). Base reutilizável:
// o create adiciona o refine; o update vira partial a partir DAQUI
// (não dá pra usar .partial() depois de um .refine()).
const transactionBase = z.object({
  tipo: z.enum(['entrada', 'saida']),
  valor: z.number().positive('O valor deve ser maior que zero'),
  moeda: z.enum(['BRL', 'USD', 'EUR']).optional().default('BRL'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD'),
  descricao: z.string().trim().max(200).optional().nullable(),
  recorrente: z.boolean().optional().default(false),
  // nº de parcelas (>= 2). Ausente/1 = compra à vista. 'valor' é sempre o TOTAL.
  parcelas: z.number().int().min(2).max(72).optional(),
  category_id: z.string().uuid().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
})

// O que a API ACEITA receber pra criar um lançamento. Se vier diferente -> 400.
export const transactionCreateSchema = transactionBase.refine(
  // Parcelar só faz sentido em saída (gasto). Entrada parcelada não existe aqui.
  (d) => !d.parcelas || d.tipo === 'saida',
  { message: 'Só dá pra parcelar uma saída', path: ['parcelas'] },
)

// Pra editar: tudo opcional (manda só o que mudou).
export const transactionUpdateSchema = transactionBase.partial()

// Filtros da listagem (vêm da URL: ?de=...&ate=...&tipo=...).
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
export const transactionFilterSchema = z.object({
  de: dataISO.optional(),
  ate: dataISO.optional(),
  tipo: z.enum(['entrada', 'saida']).optional(),
})

export type TransactionCreate = z.infer<typeof transactionCreateSchema>
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>
export type TransactionFilter = z.infer<typeof transactionFilterSchema>
