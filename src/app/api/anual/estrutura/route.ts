import { withAuth } from '@/server/http'
import { anualService } from '@/server/anual/anual.service'

// GET -> { grupos, categorias, itens } (tudo de uma vez, já em ordem)
export function GET() {
  return withAuth((ctx) => anualService.estrutura(ctx))
}
