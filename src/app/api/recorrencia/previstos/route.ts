import { withAuth } from '@/server/http'
import { recorrenciaService } from '@/server/recorrencia/recorrencia.service'

// GET ?mes=AAAA-MM-01 -> previsões do mês (com o que já foi confirmado)
export function GET(request: Request) {
  const mes = new URL(request.url).searchParams.get('mes') ?? ''
  return withAuth((ctx) => recorrenciaService.previstos(ctx, mes))
}
