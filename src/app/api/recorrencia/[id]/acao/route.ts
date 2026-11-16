import { withAuth } from '@/server/http'
import { recorrenciaService } from '@/server/recorrencia/recorrencia.service'

type Params = { params: Promise<{ id: string }> }

// POST { acao: 'pausar' | 'retomar' | 'pular' | 'finalizar' | 'reativar' | 'reajustar', ... }
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  return withAuth(async (ctx) => {
    await recorrenciaService.acao(ctx, id, await request.json())
    return { ok: true }
  })
}
