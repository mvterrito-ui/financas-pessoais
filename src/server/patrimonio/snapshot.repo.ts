import type { SupabaseClient } from '@supabase/supabase-js'

// Snapshots não usam o CRUD genérico: a operação é UPSERT por (lugar, mês).
export const snapshotRepo = {
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('wealth_snapshot')
      .select('*')
      .order('mes', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  },

  // Insere ou atualiza a foto do (place_id, mes). O unique no banco garante 1 só.
  async upsert(supabase: SupabaseClient, values: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('wealth_snapshot')
      .upsert(values, { onConflict: 'place_id,mes' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },
}
