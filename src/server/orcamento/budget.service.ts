import type { AuthContext } from '@/server/auth/context'
import { exigirTenant } from '@/server/auth/context'
import { ok } from '@/server/fluxo/crud'
import { budgetRepo } from './budget.repo'
import { budgetCreateSchema, budgetUpdateSchema } from './budget.schema'

export const budgetService = {
  list: (ctx: AuthContext) => budgetRepo.list(ctx.supabase),

  create: (ctx: AuthContext, input: unknown) => {
    const values = budgetCreateSchema.parse(input)
    return budgetRepo.create(ctx.supabase, { ...values, tenant_id: exigirTenant(ctx) })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = budgetUpdateSchema.parse(input)
    return budgetRepo.update(ctx.supabase, id, values)
  },

  // Remove a fatia; os lançamentos e recorrências dela ficam sem fatia.
  softDelete: async (ctx: AuthContext, id: string) => {
    await Promise.all([
      ctx.supabase.from('transaction').update({ budget_id: null }).eq('budget_id', id).then(ok),
      ctx.supabase.from('recorrencia').update({ budget_id: null }).eq('budget_id', id).then(ok),
    ])
    await budgetRepo.softDelete(ctx.supabase, id)
  },
}
