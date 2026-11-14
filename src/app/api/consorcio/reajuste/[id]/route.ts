import { withAuth } from '@/server/http'
import { consorcioService } from '@/server/consorcio/consorcio.service'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await consorcioService.removerReajuste(ctx, id)
    return { ok: true }
  })
}
