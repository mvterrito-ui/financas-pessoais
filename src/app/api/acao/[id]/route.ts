import { withAuth } from '@/server/http'
import { acaoService } from '@/server/acao/acao.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => acaoService.update(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await acaoService.softDelete(ctx, id)
    return { ok: true }
  })
}
