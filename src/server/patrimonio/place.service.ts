import type { AuthContext } from '@/server/auth/context'
import { placeRepo } from './place.repo'
import { placeCreateSchema, placeUpdateSchema } from './place.schema'

export const placeService = {
  list: (ctx: AuthContext) => placeRepo.list(ctx.supabase),

  create: (ctx: AuthContext, input: unknown) => {
    const values = placeCreateSchema.parse(input)
    return placeRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = placeUpdateSchema.parse(input)
    return placeRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => placeRepo.softDelete(ctx.supabase, id),
}
