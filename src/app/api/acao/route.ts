import { withAuth } from '@/server/http'
import { acaoService } from '@/server/acao/acao.service'

export function GET() {
  return withAuth((ctx) => acaoService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => acaoService.create(ctx, await request.json()), 201)
}
