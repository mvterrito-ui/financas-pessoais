import { withAuth } from '@/server/http'
import { placeService } from '@/server/patrimonio/place.service'

export function GET() {
  return withAuth((ctx) => placeService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => placeService.create(ctx, await request.json()), 201)
}
