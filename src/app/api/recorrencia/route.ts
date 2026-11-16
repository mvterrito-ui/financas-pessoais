import { withAuth } from '@/server/http'
import { recorrenciaService } from '@/server/recorrencia/recorrencia.service'

// GET -> { recorrencias, pausas, ajustes } · POST -> cria
export function GET() {
  return withAuth((ctx) => recorrenciaService.listar(ctx))
}

export function POST(request: Request) {
  return withAuth(async (ctx) => recorrenciaService.criar(ctx, await request.json()), 201)
}
