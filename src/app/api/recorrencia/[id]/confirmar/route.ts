import { withAuth } from '@/server/http'
import { recorrenciaService } from '@/server/recorrencia/recorrencia.service'

type Params = { params: Promise<{ id: string }> }

// POST { mes, valor, data, budget_id? } -> cria o lançamento daquele mês
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => recorrenciaService.confirmar(ctx, id, await request.json()), 201)
}
