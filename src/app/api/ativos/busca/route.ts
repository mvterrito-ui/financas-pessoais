import { withAuth } from '@/server/http'
import { buscarAtivosB3 } from '@/server/cotacao'

// GET ?q=PETR -> [{ ticker, nome, descricao, fii, preco }]
// Exige login (não é um proxy aberto pro Yahoo).
export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? ''
  return withAuth(() => buscarAtivosB3(q))
}
