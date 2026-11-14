import type { AuthContext } from '@/server/auth/context'
import { ErroHttp } from '@/server/erro'
import { consorcioRepo } from './consorcio.repo'
import { consorcioCreateSchema, consorcioUpdateSchema } from './consorcio.schema'

export const consorcioService = {
  list: (ctx: AuthContext) => consorcioRepo.list(ctx.supabase),

  create: (ctx: AuthContext, input: unknown) => {
    if (!ctx.tenantId) throw new ErroHttp(403, 'Usuário sem conta vinculada')
    return consorcioRepo.create(ctx.supabase, { ...consorcioCreateSchema.parse(input), tenant_id: ctx.tenantId })
  },

  update: async (ctx: AuthContext, id: string, input: unknown) => {
    const values = consorcioUpdateSchema.parse(input)
    try {
      return await consorcioRepo.update(ctx.supabase, id, values)
    } catch (e) {
      // CHECK (parcelas_pagas <= prazo_meses) do banco -> mensagem amigável
      if (/check constraint/i.test((e as Error).message))
        throw new ErroHttp(400, 'Parcelas pagas não pode passar do prazo')
      throw e
    }
  },

  softDelete: (ctx: AuthContext, id: string) => consorcioRepo.softDelete(ctx.supabase, id),
}
