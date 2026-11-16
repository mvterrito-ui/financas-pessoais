import { withAuth } from '@/server/http'
import { budgetService } from '@/server/orcamento/budget.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => budgetService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await budgetService.softDelete(ctx, id)
    return { ok: true }
  })
}
