import { z } from 'zod'
import { parcial } from '@/server/zod-util'

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, 'Use o formato AAAA-MM-01')
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')

const base = z.object({
  tipo: z.enum(['entrada', 'saida']),
  descricao: z.string().trim().min(1, 'Informe uma descrição').max(120),
  valor: z.number().positive('O valor deve ser maior que zero'),
  moeda: z.enum(['BRL', 'USD', 'EUR']).optional().default('BRL'),
  item_id: z.string().uuid().nullable().optional(),
  budget_id: z.string().uuid().nullable().optional(),
  dia: z.number().int().min(1).max(31),
  inicio: mes,
  fim: mes.nullable().optional(),
})

export const recorrenciaCreateSchema = base.refine((d) => !d.fim || d.fim >= d.inicio, { message: 'O fim não pode ser antes do início', path: ['fim'] })

export const recorrenciaUpdateSchema = parcial(base)

export const recorrenciaAcaoSchema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('pausar'), mes, ate: mes.nullable().optional() }),
  z.object({ acao: z.literal('retomar'), mes }),
  z.object({ acao: z.literal('pular'), mes }),
  z.object({ acao: z.literal('finalizar'), mes }),
  z.object({ acao: z.literal('reativar') }),
  z.object({ acao: z.literal('reajustar'), mes, valor: z.number().positive() }),
])

export const confirmarSchema = z.object({
  mes,
  valor: z.number().positive(),
  data,
  budget_id: z.string().uuid().nullable().optional(),
})
