import { withAuth } from '@/server/http'
import { consorcioService } from '@/server/consorcio/consorcio.service'

export function GET() {
  return withAuth((ctx) => consorcioService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => consorcioService.create(ctx, await request.json()), 201)
}
