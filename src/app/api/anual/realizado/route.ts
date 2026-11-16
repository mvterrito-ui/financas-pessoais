import { withAuth } from '@/server/http'
import { anualService } from '@/server/anual/anual.service'

// GET ?ano=2026 -> { realizado, previsto, semCategoria } (agregado por categoria e mês)
export function GET(request: Request) {
  const ano = Number(new URL(request.url).searchParams.get('ano'))
  return withAuth((ctx) => anualService.realizadoDoAno(ctx, ano))
}
