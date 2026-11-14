import type { AuthContext } from '@/server/auth/context'
import { ErroHttp } from '@/server/erro'
import { consorcioRepo, reajusteRepo } from './consorcio.repo'
import { consorcioCreateSchema, consorcioUpdateSchema, reajusteSetSchema } from './consorcio.schema'

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

  // ---- reajustes da parcela
  reajustes: (ctx: AuthContext) => reajusteRepo.list(ctx.supabase),

  gravarReajuste: async (ctx: AuthContext, input: unknown) => {
    if (!ctx.tenantId) throw new ErroHttp(403, 'Usuário sem conta vinculada')
    const values = reajusteSetSchema.parse(input)
    const c = await consorcioRepo.getById(ctx.supabase, values.consorcio_id) // 404 se não for dele
    if (values.a_partir_parcela > c.prazo_meses)
      throw new ErroHttp(400, `O consórcio tem ${c.prazo_meses} parcelas`)
    return reajusteRepo.gravar(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  removerReajuste: (ctx: AuthContext, id: string) => reajusteRepo.remover(ctx.supabase, id),
}
