import { withAuth } from '@/server/http'
import { transactionService } from '@/server/fluxo/transaction.service'

// DELETE /api/transaction/grupo/:grupo -> apaga a compra parcelada inteira.
type Params = { params: Promise<{ grupo: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { grupo } = await params
  return withAuth(async (ctx) => {
    await transactionService.softDeleteGrupo(ctx, grupo)
    return { ok: true }
  })
}
