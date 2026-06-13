import { withAuth } from '@/server/http'
import { transactionService } from '@/server/fluxo/transaction.service'

// Em rota dinâmica [id], os params vêm como Promise no Next 16.
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth((ctx) => transactionService.getById(ctx, id))
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => transactionService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await transactionService.softDelete(ctx, id)
    return { ok: true }
  })
}
