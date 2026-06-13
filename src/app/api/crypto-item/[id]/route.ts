import { withAuth } from '@/server/http'
import { itemService } from '@/server/cripto/item.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => itemService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await itemService.softDelete(ctx, id)
    return { ok: true }
  })
}
