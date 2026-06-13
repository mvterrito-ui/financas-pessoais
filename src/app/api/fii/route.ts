import { withAuth } from '@/server/http'
import { fiiService } from '@/server/fii/fii.service'

export function GET() {
  return withAuth((ctx) => fiiService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => fiiService.create(ctx, await request.json()), 201)
}
