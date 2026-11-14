import { withAuth } from '@/server/http'
import { anualService } from '@/server/anual/anual.service'

export function POST(request: Request) {
  return withAuth(async (ctx) => anualService.criarCategoria(ctx, await request.json()), 201)
}
