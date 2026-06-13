import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profile')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  return {
    supabase,
    userId: user.id,
    tenantId: profile.tenant_id,
    role: profile.role,
  }
}
