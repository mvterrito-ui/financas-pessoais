import type { AuthContext } from '@/server/auth/context'
import { accountRepo } from './account.repo'
import { accountCreateSchema, accountUpdateSchema } from './account.schema'

export const accountService = {
  list: (ctx: AuthContext) => accountRepo.list(ctx.supabase),

  getById: (ctx: AuthContext, id: string) => accountRepo.getById(ctx.supabase, id),

  create: (ctx: AuthContext, input: unknown) => {
    const values = accountCreateSchema.parse(input)
    return accountRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = accountUpdateSchema.parse(input)
    return accountRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => accountRepo.softDelete(ctx.supabase, id),
}
