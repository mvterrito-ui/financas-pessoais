import type { AuthContext } from '@/server/auth/context'
import { fixedIncomeRepo } from './fixed-income.repo'
import { fixedIncomeCreateSchema, fixedIncomeUpdateSchema } from './fixed-income.schema'

export const fixedIncomeService = {
  list: (ctx: AuthContext) => fixedIncomeRepo.list(ctx.supabase),

  create: (ctx: AuthContext, input: unknown) => {
    const values = fixedIncomeCreateSchema.parse(input)
    return fixedIncomeRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = fixedIncomeUpdateSchema.parse(input)
    return fixedIncomeRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => fixedIncomeRepo.softDelete(ctx.supabase, id),
}
