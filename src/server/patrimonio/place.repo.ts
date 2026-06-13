import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from '@/server/fluxo/crud'

const base = makeRepo('wealth_place')

export const placeRepo = {
  ...base,
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('wealth_place')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },
}
