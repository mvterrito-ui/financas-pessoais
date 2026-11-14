import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from '@/server/fluxo/crud'

const base = makeRepo('consorcio')

export const consorcioRepo = {
  ...base,
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('consorcio')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },
}
