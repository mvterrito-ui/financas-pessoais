import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ErroHttp } from '@/server/erro'

// O "quem está logado" que toda rota de API usa.
// Devolve o supabase já com a sessão (pro RLS isolar por tenant),
// mais o userId, o tenantId e o papel. Se não tem login -> null (vira 401).
export type AuthContext = {
  supabase: SupabaseClient
  userId: string
  tenantId: string | null
  role: 'manager' | 'member'
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient()

  // getClaims() valida o JWT localmente (chave assimétrica) — sem a ida ao
  // servidor de Auth que o getUser() faz em toda chamada.
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null

  const { data: profile } = await supabase
    .from('profile')
    .select('tenant_id, role')
    .eq('id', userId)
    .single()
  if (!profile) return null

  return {
    supabase,
    userId,
    tenantId: profile.tenant_id,
    role: profile.role,
  }
}

/** tenant do usuário logado (403 se a conta não estiver vinculada a um). */
export function exigirTenant(ctx: AuthContext): string {
  if (!ctx.tenantId) throw new ErroHttp(403, 'Usuário sem conta vinculada')
  return ctx.tenantId
}
