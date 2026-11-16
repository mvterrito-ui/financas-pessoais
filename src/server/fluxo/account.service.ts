import type { AuthContext } from '@/server/auth/context'
import { exigirTenant } from '@/server/auth/context'
import { budgetRepo } from '@/server/orcamento/budget.repo'
import { accountRepo } from './account.repo'
import { accountCreateSchema, accountUpdateSchema } from './account.schema'

// A FK não passa pelo RLS: confere que a fatia é do usuário (getById passa).
async function validarFatia(ctx: AuthContext, budgetId: string | null | undefined) {
  if (budgetId) await budgetRepo.getById(ctx.supabase, budgetId)
}

export const accountService = {
  list: (ctx: AuthContext) => accountRepo.list(ctx.supabase),

  getById: (ctx: AuthContext, id: string) => accountRepo.getById(ctx.supabase, id),

  create: async (ctx: AuthContext, input: unknown) => {
    const values = accountCreateSchema.parse(input)
    await validarFatia(ctx, values.budget_id)
    return accountRepo.create(ctx.supabase, { ...values, tenant_id: exigirTenant(ctx) })
  },

  update: async (ctx: AuthContext, id: string, input: unknown) => {
    const values = accountUpdateSchema.parse(input)
    await validarFatia(ctx, values.budget_id)
    return accountRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => accountRepo.softDelete(ctx.supabase, id),
}
