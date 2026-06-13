import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from '@/server/fluxo/crud'

const base = makeRepo('fii')

export const fiiRepo = {
  ...base,
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('fii')
      .select('*')
      .eq('ativo', true)
      .order('ticker', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },
}
