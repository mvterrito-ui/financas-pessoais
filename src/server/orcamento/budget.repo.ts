import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from '@/server/fluxo/crud'

const base = makeRepo('budget_bucket')

// Reusa o CRUD genérico, mas lista em ordem crescente de `ordem`.
export const budgetRepo = {
  ...base,
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('budget_bucket')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },
}
