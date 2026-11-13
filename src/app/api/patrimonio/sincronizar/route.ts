import { withAuth } from '@/server/http'
import { sincronizarMes } from '@/server/patrimonio/investimentos'

// POST -> grava a foto do mês atual (horário de Brasília) do usuário logado:
// investimentos com o valor de hoje + bens manuais herdados do mês anterior.
export function POST() {
  return withAuth(async (ctx) => {
    if (!ctx.tenantId) throw new Error('Usuário sem tenant')
    return sincronizarMes(ctx.supabase, ctx.tenantId)
  })
}
