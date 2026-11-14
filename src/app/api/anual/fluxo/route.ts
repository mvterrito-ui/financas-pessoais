import { withAuth } from '@/server/http'
import { anualService } from '@/server/anual/anual.service'

// GET ?ano=2026 -> o que vem do Fluxo de Caixa pros itens ligados (agregado).
export function GET(request: Request) {
  const ano = Number(new URL(request.url).searchParams.get('ano'))
  return withAuth((ctx) => anualService.fluxoDoAno(ctx, ano))
}
