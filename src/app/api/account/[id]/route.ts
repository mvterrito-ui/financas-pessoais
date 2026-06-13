import { withAuth } from '@/server/http'
import { accountService } from '@/server/fluxo/account.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => accountService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await accountService.softDelete(ctx, id)
    return { ok: true }
  })
}
