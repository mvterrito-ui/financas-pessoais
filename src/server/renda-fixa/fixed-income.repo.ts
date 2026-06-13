import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from '@/server/fluxo/crud'

const base = makeRepo('fixed_income')

export const fixedIncomeRepo = {
  ...base,
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('fixed_income')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },
}
