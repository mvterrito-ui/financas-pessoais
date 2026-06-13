import { withAuth } from '@/server/http'
import { placeService } from '@/server/patrimonio/place.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => placeService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await placeService.softDelete(ctx, id)
    return { ok: true }
  })
}
