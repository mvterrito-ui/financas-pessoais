import { withAuth } from '@/server/http'
import { snapshotService } from '@/server/patrimonio/snapshot.service'

export function GET() {
  return withAuth((ctx) => snapshotService.list(ctx))
}

// POST = define (insere ou atualiza) a foto de um lugar num mês.
export function POST(request: Request) {
  return withAuth(async (ctx) => snapshotService.set(ctx, await request.json()))
}
