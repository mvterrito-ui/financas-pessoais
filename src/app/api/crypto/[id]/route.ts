import { withAuth } from '@/server/http'
import { cryptoService } from '@/server/cripto/crypto.service'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await cryptoService.remove(ctx, id)
    return { ok: true }
  })
}
