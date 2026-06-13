import { withAuth } from '@/server/http'
import { accountService } from '@/server/fluxo/account.service'

export function GET() {
  return withAuth((ctx) => accountService.list(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => accountService.create(ctx, await request.json()), 201)
}
