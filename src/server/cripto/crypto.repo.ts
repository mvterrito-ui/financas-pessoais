import type { SupabaseClient } from '@supabase/supabase-js'

export const cryptoRepo = {
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('crypto_summary')
      .select('*')
      .order('ano', { ascending: false })
      .order('exchange', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },

  // Upsert por (tenant_id, exchange, ano): 1 registro por corretora/ano.
  async upsert(supabase: SupabaseClient, values: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('crypto_summary')
      .upsert(values, { onConflict: 'tenant_id,exchange,ano' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async remove(supabase: SupabaseClient, id: string) {
    const { error } = await supabase.from('crypto_summary').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
