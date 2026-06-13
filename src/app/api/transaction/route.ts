import { withAuth } from '@/server/http'
import { transactionService } from '@/server/fluxo/transaction.service'

// GET  /api/transaction?de=&ate=&tipo=   -> lista (com filtros opcionais)
export function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filtros = {
    de: searchParams.get('de') ?? undefined,
    ate: searchParams.get('ate') ?? undefined,
    tipo: searchParams.get('tipo') ?? undefined,
  }
  return withAuth((ctx) => transactionService.list(ctx, filtros))
}

// POST /api/transaction      -> cria um lançamento (201)
export function POST(request: Request) {
  return withAuth(async (ctx) => transactionService.create(ctx, await request.json()), 201)
}
