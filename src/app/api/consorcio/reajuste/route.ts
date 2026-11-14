import { withAuth } from '@/server/http'
import { consorcioService } from '@/server/consorcio/consorcio.service'

// GET -> todos os reajustes do usuário · POST { consorcio_id, a_partir_parcela, valor_parcela }
export function GET() {
  return withAuth((ctx) => consorcioService.reajustes(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => consorcioService.gravarReajuste(ctx, await request.json()), 201)
}
