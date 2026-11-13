import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSAO_MAX_HORAS, loginEmMsDosClaims } from '@/lib/sessao'

// Roda em TODA requisição (chamado pelo proxy.ts): renova a sessão,
// manda quem não está logado pro /login e aplica o limite de 12h.
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

  // getClaims(): valida o JWT (localmente, com chave assimétrica — sem ida
  // ao Supabase) e renova a sessão se o token venceu. Bem mais barato que
  // getUser(), que SEMPRE vai ao servidor de Auth.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const { pathname } = request.nextUrl
  const ehApi = pathname.startsWith('/api')
  const ehLogin = pathname === '/login'

  // Copia os cookies (sessão renovada/limpa) pra uma resposta nova.
  const comCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  // Sem login: páginas vão pro /login. (As rotas /api respondem 401 sozinhas
  // no withAuth; o cron tem o próprio segredo.)
  if (!claims) {
    if (!ehApi && !ehLogin) return comCookies(NextResponse.redirect(new URL('/login', request.url)))
    return response
  }

  // Logout automático: 12h depois do LOGIN (não do último uso).
  const login = loginEmMsDosClaims(claims)
  if (login !== null && Date.now() >= login + SESSAO_MAX_HORAS * 3600_000) {
    await supabase.auth.signOut() // limpa os cookies (via setAll -> response)
    return comCookies(
      ehApi
        ? NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
        : NextResponse.redirect(new URL('/login?expirou=1', request.url)),
    )
  }

  return response
}
