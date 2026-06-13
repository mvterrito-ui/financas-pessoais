import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthContext, type AuthContext } from '@/server/auth/context'

// Toda rota faz a mesma dança:
//   sem sessão        -> 401
//   dados inválidos   -> 400 (ZodError)
//   qualquer erro     -> 500
//   sucesso           -> 200 (ou 201 no create)
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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
