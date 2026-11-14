import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/server/supabase-admin'
import { sincronizarMes } from '@/server/patrimonio/investimentos'

// Cron diário da Vercel (vercel.json): ~23h de Brasília grava a foto do mês
// de TODOS os usuários. Como roda todo dia, a última execução do mês (dia
// 30/31) vira o fechamento — mesmo que ninguém abra o app.
//
// Proteção: a Vercel manda "Authorization: Bearer $CRON_SECRET". Sem o
// segredo certo -> 401 (ninguém de fora consegue disparar).
export const maxDuration = 60

// Comparação em tempo constante (não vaza o segredo por tempo de resposta).
function iguaisSeguro(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !iguaisSeguro(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const sb = createSupabaseAdminClient()
  const { data: tenants, error } = await sb.from('tenant').select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Um tenant com problema não impede os outros.
  const resultados = await Promise.allSettled(tenants.map((t) => sincronizarMes(sb, t.id)))
  const falhas = resultados.flatMap((r, i) =>
    r.status === 'rejected' ? [{ tenant: tenants[i].id, erro: String(r.reason?.message ?? r.reason) }] : [],
  )
  if (falhas.length) console.error('[cron/fechamento] falhas:', falhas)

  return NextResponse.json({ ok: falhas.length === 0, tenants: tenants.length, falhas: falhas.length })
}
