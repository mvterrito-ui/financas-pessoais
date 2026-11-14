import type { AuthContext } from '@/server/auth/context'
import { placeRepo } from './place.repo'
import { placeCreateSchema, placeUpdateSchema } from './place.schema'
import { ErroHttp } from '@/server/erro'

// Lugares automáticos (Ações, FIIs...) são geridos pelo app: não se edita
// nem remove na mão — o valor vem do módulo.
export async function garantirManual(ctx: AuthContext, id: string) {
  const place = await placeRepo.getById(ctx.supabase, id)
  if (place.origem) throw new ErroHttp(400, 'Este lugar é automático (vem dos investimentos) e não pode ser alterado aqui.')
}

export const placeService = {
  list: (ctx: AuthContext) => placeRepo.list(ctx.supabase),

  create: (ctx: AuthContext, input: unknown) => {
    const values = placeCreateSchema.parse(input)
    return placeRepo.create(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  update: async (ctx: AuthContext, id: string, input: unknown) => {
    const values = placeUpdateSchema.parse(input)
    await garantirManual(ctx, id)
    return placeRepo.update(ctx.supabase, id, values)
  },

  softDelete: async (ctx: AuthContext, id: string) => {
    await garantirManual(ctx, id)
    return placeRepo.softDelete(ctx.supabase, id)
  },
}
