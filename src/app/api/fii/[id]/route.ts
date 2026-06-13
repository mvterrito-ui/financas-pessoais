import { withAuth } from '@/server/http'
import { fiiService } from '@/server/fii/fii.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => fiiService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await fiiService.softDelete(ctx, id)
    return { ok: true }
  })
}
