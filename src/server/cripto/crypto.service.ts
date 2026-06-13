import type { AuthContext } from '@/server/auth/context'
import { cryptoRepo } from './crypto.repo'
import { cryptoSetSchema } from './crypto.schema'

export const cryptoService = {
  list: (ctx: AuthContext) => cryptoRepo.list(ctx.supabase),

  set: (ctx: AuthContext, input: unknown) => {
    const values = cryptoSetSchema.parse(input)
    return cryptoRepo.upsert(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },

  remove: (ctx: AuthContext, id: string) => cryptoRepo.remove(ctx.supabase, id),
}
