import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { sessaoExpirada } from '@/lib/sessao'

// Roda em TODA requisição (chamado pelo proxy.ts).
// O getUser() revalida o token e regrava o cookie da sessão -> sem isso,
// a sessão "expira" e o usuário é deslogado do nada.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Logout automático: 12h depois do LOGIN (não do último uso).
  // getUser() já validou o token no Auth server, então ler o payload da
  // sessão aqui é seguro.
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (sessaoExpirada(session?.access_token)) {
      await supabase.auth.signOut() // limpa os cookies (via setAll -> response)
      const destino = request.nextUrl.pathname.startsWith('/api')
        ? NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
        : NextResponse.redirect(new URL('/login?expirou=1', request.url))
      response.cookies.getAll().forEach((c) => destino.cookies.set(c))
      return destino
    }
  }

  return response
}
