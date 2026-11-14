import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthContext, type AuthContext } from '@/server/auth/context'
import { ErroHttp } from '@/server/erro'

// Toda rota faz a mesma dança:
//   sem sessão          -> 401
//   dados inválidos     -> 400 (ZodError, JSON quebrado, id que não é UUID)
//   ErroHttp            -> o status dele, com a mensagem pro usuário
//   registro não achado -> 404
//   qualquer outro erro -> 500 genérico (detalhe do banco só no log)
//   sucesso             -> 200 (ou 201 no create)
// Então a gente embrulha isso num lugar só.
export async function withAuth(
  fn: (ctx: AuthContext) => Promise<unknown>,
  okStatus = 200,
) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const result = await fn(ctx)
    return NextResponse.json(result, { status: okStatus })
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', detalhes: e.issues },
        { status: 400 },
      )
    }
    if (e instanceof ErroHttp) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
    }
    const msg = (e as Error)?.message ?? ''
    // .single() sem linha (id inexistente ou de outro usuário, barrado pelo RLS)
    if (/no\) rows returned|multiple \(or no\) rows|Cannot coerce the result to a single/i.test(msg)) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }
    if (/invalid input syntax for type (uuid|date)|date\/time field value out of range/i.test(msg)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    console.error('[api] erro inesperado:', e)
    return NextResponse.json({ error: 'Erro no servidor. Tente de novo.' }, { status: 500 })
  }
}
