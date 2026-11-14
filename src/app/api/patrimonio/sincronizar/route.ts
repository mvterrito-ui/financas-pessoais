import { withAuth } from '@/server/http'
import { sincronizarMes } from '@/server/patrimonio/investimentos'
import { ErroHttp } from '@/server/erro'

// POST -> grava a foto do mês atual (horário de Brasília) do usuário logado:
// investimentos com o valor de hoje + bens manuais herdados do mês anterior.
export function POST() {
  return withAuth(async (ctx) => {
    if (!ctx.tenantId) throw new ErroHttp(403, 'Usuário sem conta vinculada')
    return sincronizarMes(ctx.supabase, ctx.tenantId)
  })
}
