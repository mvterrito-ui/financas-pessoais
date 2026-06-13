import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from '@/server/fluxo/crud'

const base = makeRepo('crypto_item')

export const itemRepo = {
  ...base,
  // Lista os itens de UMA corretora (summary), em ordem.
  async listBySummary(supabase: SupabaseClient, summaryId: string) {
    const { data, error } = await supabase
      .from('crypto_item')
      .select('*')
      .eq('ativo', true)
      .eq('summary_id', summaryId)
      .order('ordem', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },
}
