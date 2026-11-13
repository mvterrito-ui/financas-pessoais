import type { AuthContext } from '@/server/auth/context'
import { snapshotRepo } from './snapshot.repo'
import { snapshotSetSchema } from './snapshot.schema'
import { garantirManual } from './place.service'

export const snapshotService = {
  list: (ctx: AuthContext) => snapshotRepo.list(ctx.supabase),

  set: async (ctx: AuthContext, input: unknown) => {
    const values = snapshotSetSchema.parse(input)
    await garantirManual(ctx, values.place_id)
    return snapshotRepo.upsert(ctx.supabase, { ...values, tenant_id: ctx.tenantId })
  },
}
