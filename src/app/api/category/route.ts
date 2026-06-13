import { withAuth } from '@/server/http'
import { categoryService } from '@/server/fluxo/category.service'

export function GET() {
  return withAuth((ctx) => categoryService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => categoryService.create(ctx, await request.json()), 201)
}
