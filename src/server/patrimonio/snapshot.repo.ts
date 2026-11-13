import type { SupabaseClient } from '@supabase/supabase-js'

// Snapshots não usam o CRUD genérico: a operação é UPSERT por (lugar, mês).
export const snapshotRepo = {
  // Fotos que CONTAM no patrimônio:
  //  - lugar removido (ativo = false): nenhuma (some do histórico todo);
  //  - lugar oculto: só as de meses ANTERIORES ao oculto_desde.
  // (Comparação entre colunas não dá no PostgREST -> filtra aqui.)
  async list(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('wealth_snapshot')
      .select('*, wealth_place!inner(ativo, oculto_desde)')
      .eq('wealth_place.ativo', true)
      .order('mes', { ascending: true })
    if (error) throw new Error(error.message)
    return data
      .filter((row) => {
        const desde = row.wealth_place?.oculto_desde as string | null
        return !desde || String(row.mes).slice(0, 10) < desde.slice(0, 10)
      })
      .map((row) => {
        const { wealth_place, ...snap } = row
        void wealth_place
        return snap
      })
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
