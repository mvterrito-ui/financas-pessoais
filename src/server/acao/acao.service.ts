import type { AuthContext } from '@/server/auth/context'
// Ação tem o mesmo formato de posição do FII (ticker, quantidade, preço médio).
import { fiiCreateSchema as acaoCreateSchema, fiiUpdateSchema as acaoUpdateSchema } from '@/server/fii/fii.schema'
import { acaoRepo } from './acao.repo'

export const acaoService = {
  list: (ctx: AuthContext) => acaoRepo.list(ctx.supabase),

  create: (ctx: AuthContext, input: unknown) => {
    const values = acaoCreateSchema.parse(input)
    return acaoRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = acaoUpdateSchema.parse(input)
    return acaoRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) => acaoRepo.softDelete(ctx.supabase, id),
}
