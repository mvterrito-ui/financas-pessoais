import { NextResponse } from 'next/server'
import { getAuthContext } from '@/server/auth/context'
import { backupService } from '@/server/backup/backup.service'
import { ErroHttp } from '@/server/erro'
import { hojeISO } from '@/lib/utils'

export const maxDuration = 60

// GET -> baixa um arquivo .json com todos os dados da conta logada.
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const backup = await backupService.gerar(ctx)
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="financas-backup-${hojeISO()}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    if (e instanceof ErroHttp) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[api/backup] erro:', e)
    return NextResponse.json({ error: 'Não foi possível gerar o backup. Tente de novo.' }, { status: 500 })
  }
}
