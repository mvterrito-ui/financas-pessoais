import { withAuth } from '@/server/http'
import { anualService } from '@/server/anual/anual.service'

// GET ?ano=2026 -> [{ item_id, mes, valor }]
export function GET(request: Request) {
  const ano = Number(new URL(request.url).searchParams.get('ano'))
  return withAuth((ctx) => anualService.valoresDoAno(ctx, ano))
}

// POST { item_id, valores: [{ mes: 'AAAA-MM-01', valor: number | null }] }
export function POST(request: Request) {
  return withAuth(async (ctx) => anualService.gravarValores(ctx, await request.json()))
}
