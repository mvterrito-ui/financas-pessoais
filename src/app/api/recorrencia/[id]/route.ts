import { withAuth } from '@/server/http'
import { recorrenciaService } from '@/server/recorrencia/recorrencia.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => recorrenciaService.editar(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await recorrenciaService.remover(ctx, id)
    return { ok: true }
  })
}
