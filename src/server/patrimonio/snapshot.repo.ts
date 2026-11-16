import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarTudo } from '@/server/fluxo/crud'

// Snapshots não usam o CRUD genérico: a operação é UPSERT por (lugar, mês).
export const snapshotRepo = {
  // Fotos que contam no patrimônio: as de todos os lugares ativos. Lugar
  // removido (ativo = false) some do histórico todo. Lugar oculto continua
  // contando (ocultar só tira da lista na tela).
  async list(supabase: SupabaseClient) {
    // Paginado (o Supabase corta em 1000): sem isso, com muitos anos de
    // histórico, os meses MAIS RECENTES sumiam (a lista vem em ordem crescente).
    const data = await buscarTudo<Record<string, unknown> & { mes: string; wealth_place?: unknown }>(
      (de, ate) =>
        supabase
          .from('wealth_snapshot')
          .select('*, wealth_place!inner(ativo)')
          .eq('wealth_place.ativo', true)
          .order('mes', { ascending: true })
          .order('id')
          .range(de, ate),
    )
    return data.map((row) => {
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
