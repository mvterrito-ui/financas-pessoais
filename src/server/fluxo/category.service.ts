import type { AuthContext } from '@/server/auth/context'
import { categoryRepo } from './category.repo'
import { categoryCreateSchema, categoryUpdateSchema } from './category.schema'

export const categoryService = {
  list: (ctx: AuthContext) => categoryRepo.list(ctx.supabase),

  getById: (ctx: AuthContext, id: string) => categoryRepo.getById(ctx.supabase, id),

  create: (ctx: AuthContext, input: unknown) => {
    const values = categoryCreateSchema.parse(input)
    return categoryRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = categoryUpdateSchema.parse(input)
    return categoryRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => categoryRepo.softDelete(ctx.supabase, id),
}
