import type { AuthContext } from '@/server/auth/context'
import { itemRepo } from './item.repo'
import { itemCreateSchema, itemUpdateSchema } from './item.schema'

export const itemService = {
  list: (ctx: AuthContext, summaryId: string) =>
    itemRepo.listBySummary(ctx.supabase, summaryId),

  create: (ctx: AuthContext, input: unknown) => {
    const values = itemCreateSchema.parse(input)
    return itemRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = itemUpdateSchema.parse(input)
    return itemRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => itemRepo.softDelete(ctx.supabase, id),
}
