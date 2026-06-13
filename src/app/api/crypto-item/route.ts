import { withAuth } from '@/server/http'
import { itemService } from '@/server/cripto/item.service'

// GET /api/crypto-item?summary_id=...  -> itens daquela corretora
export function GET(request: Request) {
  const summaryId = new URL(request.url).searchParams.get('summary_id') ?? ''
  return withAuth((ctx) => itemService.list(ctx, summaryId))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => itemService.create(ctx, await request.json()), 201)
}
