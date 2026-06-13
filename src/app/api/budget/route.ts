import { withAuth } from '@/server/http'
import { budgetService } from '@/server/orcamento/budget.service'

export function GET() {
  return withAuth((ctx) => budgetService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => budgetService.create(ctx, await request.json()), 201)
}
