import { createClient } from '@supabase/supabase-js'

// Cliente ADMIN (service_role): FURA o RLS. Só pra tarefas sem usuário
// logado (cron). Nunca importar em código de cliente; a chave não tem
// NEXT_PUBLIC_, então nem chega ao navegador. Quem usa DEVE filtrar por tenant.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
