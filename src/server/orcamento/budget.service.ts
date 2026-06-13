import type { AuthContext } from '@/server/auth/context'
import { budgetRepo } from './budget.repo'
import { budgetCreateSchema, budgetUpdateSchema } from './budget.schema'

export const budgetService = {
  list: (ctx: AuthContext) => budgetRepo.list(ctx.supabase),

  getById: (ctx: AuthContext, id: string) => budgetRepo.getById(ctx.supabase, id),

  create: (ctx: AuthContext, input: unknown) => {
    const values = budgetCreateSchema.parse(input)
    return budgetRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = budgetUpdateSchema.parse(input)
    return budgetRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => budgetRepo.softDelete(ctx.supabase, id),
}
