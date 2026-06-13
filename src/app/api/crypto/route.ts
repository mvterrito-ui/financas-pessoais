import { withAuth } from '@/server/http'
import { cryptoService } from '@/server/cripto/crypto.service'

export function GET() {
  return withAuth((ctx) => cryptoService.list(ctx))
}

// POST = define (insere ou atualiza) o resumo de uma corretora num ano.
export function POST(request: Request) {
  return withAuth(async (ctx) => cryptoService.set(ctx, await request.json()))
}
