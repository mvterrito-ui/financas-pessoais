import { withAuth } from '@/server/http'
import { categoryService } from '@/server/fluxo/category.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => categoryService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await categoryService.softDelete(ctx, id)
    return { ok: true }
  })
}
