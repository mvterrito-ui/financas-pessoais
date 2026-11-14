import { withAuth } from '@/server/http'
import { anualService } from '@/server/anual/anual.service'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => anualService.editarGrupo(ctx, id, await request.json()))
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await anualService.removerGrupo(ctx, id)
    return { ok: true }
  })
}
