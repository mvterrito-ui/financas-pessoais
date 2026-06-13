import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// No Next 16 o "middleware" chama-se proxy.ts (export function proxy).
// Toda requisição passa por aqui antes da página -> renova a sessão.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Roda em tudo, menos arquivos estáticos e imagens.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
