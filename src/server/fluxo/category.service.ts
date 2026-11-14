import type { AuthContext } from '@/server/auth/context'
import { categoryRepo } from './category.repo'
import { itemRepo } from '@/server/anual/anual.repo'
import { categoryCreateSchema, categoryUpdateSchema } from './category.schema'

export const categoryService = {
  list: (ctx: AuthContext) => categoryRepo.list(ctx.supabase),

  getById: (ctx: AuthContext, id: string) => categoryRepo.getById(ctx.supabase, id),

  create: (ctx: AuthContext, input: unknown) => {
    const values = categoryCreateSchema.parse(input)
    return categoryRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: async (ctx: AuthContext, id: string, input: unknown) => {
    const values = categoryUpdateSchema.parse(input)
    // Ligação com o Controle Anual: o item tem que ser DESTE usuário (a FK do
    // banco não passa pelo RLS). getById falha (404) se não for.
    if (values.annual_item_id) await itemRepo.getById(ctx.supabase, values.annual_item_id)
    return categoryRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => categoryRepo.softDelete(ctx.supabase, id),
}
