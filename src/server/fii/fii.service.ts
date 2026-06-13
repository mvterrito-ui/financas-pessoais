import type { AuthContext } from '@/server/auth/context'
import { fiiRepo } from './fii.repo'
import { fiiCreateSchema, fiiUpdateSchema } from './fii.schema'

export const fiiService = {
  list: (ctx: AuthContext) => fiiRepo.list(ctx.supabase),

  create: (ctx: AuthContext, input: unknown) => {
    const values = fiiCreateSchema.parse(input)
    return fiiRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = fiiUpdateSchema.parse(input)
    return fiiRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => fiiRepo.softDelete(ctx.supabase, id),
}
