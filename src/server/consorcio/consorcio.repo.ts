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

export const reajusteRepo = {
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('consorcio_reajuste')
      .select('id, consorcio_id, a_partir_parcela, valor_parcela')
      .order('a_partir_parcela', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },

  async gravar(supabase: SupabaseClient, values: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('consorcio_reajuste')
      .upsert(values, { onConflict: 'consorcio_id,a_partir_parcela' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async remover(supabase: SupabaseClient, id: string) {
    const { error } = await supabase.from('consorcio_reajuste').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
