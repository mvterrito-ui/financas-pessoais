import { createBrowserClient } from '@supabase/ssr'

// Supabase rodando NO NAVEGADOR (Client Components, 'use client').
// Usa só a chave pública (anon). É o que faz login e fetch do lado do usuário.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
