import { withAuth } from '@/server/http'
import { fixedIncomeService } from '@/server/renda-fixa/fixed-income.service'

export function GET() {
  return withAuth((ctx) => fixedIncomeService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => fixedIncomeService.create(ctx, await request.json()), 201)
}
