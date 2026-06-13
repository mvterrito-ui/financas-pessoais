import { withAuth } from '@/server/http'
import { fixedIncomeService } from '@/server/renda-fixa/fixed-income.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => fixedIncomeService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await fixedIncomeService.softDelete(ctx, id)
    return { ok: true }
  })
}
