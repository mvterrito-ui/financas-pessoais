import { withAuth } from '@/server/http'
import { sincronizarInvestimentos } from '@/server/patrimonio/investimentos'

// POST { mes: 'AAAA-MM-01' } -> grava a foto do mês dos lugares automáticos
// (Ações, FIIs, Renda Fixa, Cripto) com o valor atual de cada módulo.
export function POST(request: Request) {
  return withAuth(async (ctx) => {
    const { mes } = await request.json()
    return sincronizarInvestimentos(ctx, String(mes))
  })
}
