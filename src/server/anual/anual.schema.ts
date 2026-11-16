import { z } from 'zod'
import { parcial } from '@/server/zod-util'

const nome = z.string().trim().min(1, 'Informe um nome').max(80)
const uuid = z.string().uuid()
const mes = z.string().regex(/^\d{4}-\d{2}-01$/, 'Use o formato AAAA-MM-01')

export const grupoCreateSchema = z.object({
  name: nome,
  tipo: z.enum(['receita', 'investimento', 'despesa']),
  descricao: z.string().trim().max(200).nullable().optional(),
  // Meta em % da receita (substitui os "baldes" do antigo Orçamento).
  meta_pct: z.number().min(0).max(100).nullable().optional(),
  ordem: z.number().int().optional().default(0),
})
export const grupoUpdateSchema = parcial(grupoCreateSchema)

export const categoriaCreateSchema = z.object({
  group_id: uuid,
  name: nome,
  ordem: z.number().int().optional().default(0),
})
export const categoriaUpdateSchema = parcial(categoriaCreateSchema.omit({ group_id: true }))

export const itemCreateSchema = z.object({
  group_id: uuid,
  category_id: uuid.nullable().optional(),
  name: nome,
  ordem: z.number().int().optional().default(0),
})
export const itemUpdateSchema = parcial(itemCreateSchema.omit({ group_id: true })).extend({
  oculto: z.boolean().optional(),
})

// Grava vários meses de um item de uma vez. valor null = esvaziar o mês.
export const valoresSetSchema = z.object({
  item_id: uuid,
  valores: z
    .array(z.object({ mes, valor: z.number().min(0).nullable() }))
    .min(1)
    .max(12),
})
