import type { AuthContext } from '@/server/auth/context'
import { snapshotRepo } from './snapshot.repo'
import { snapshotSetSchema } from './snapshot.schema'

export const snapshotService = {
  list: (ctx: AuthContext) => snapshotRepo.list(ctx.supabase),

  set: (ctx: AuthContext, input: unknown) => {
    const values = snapshotSetSchema.parse(input)
    return snapshotRepo.upsert(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },
}
