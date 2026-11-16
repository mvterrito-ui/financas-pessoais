import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarTudo, makeRepo } from './crud'
import type { TransactionFilter } from './transaction.schema'

const base = makeRepo('transaction')

// Lista com filtros opcionais. Cada filtro vira um pedaço da query no banco.
// (Sem filtro de tenant: o RLS isola sozinho.)
export const transactionRepo = {
  ...base,
  // Paginado: o Supabase corta em 1000 linhas por resposta (sem avisar).
  async list(supabase: SupabaseClient, filtros: TransactionFilter = {}) {
    return buscarTudo((de, ate) => {
      let query = supabase.from('transaction').select('*').eq('ativo', true)
      if (filtros.de) query = query.gte('data', filtros.de)
      if (filtros.ate) query = query.lte('data', filtros.ate)
      if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
      return query.order('data', { ascending: false }).order('id').range(de, ate)
    })
  },

  // Quais desses external_id já existem (pra não duplicar na importação).
  // Em lotes: o .in() vai na URL, e um extrato grande estourava o tamanho dela.
  async existingExternalIds(supabase: SupabaseClient, ids: string[]) {
    const achados: string[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase
        .from('transaction')
        .select('external_id')
        .in('external_id', ids.slice(i, i + 100))
      if (error) throw new Error(error.message)
      achados.push(...(data ?? []).map((d) => d.external_id as string))
    }
    return achados
  },

  async insertMany(supabase: SupabaseClient, rows: Record<string, unknown>[]) {
    if (rows.length === 0) return
    const { error } = await supabase.from('transaction').insert(rows)
    if (error) throw new Error(error.message)
  },

  // Apaga (soft) todas as parcelas de uma compra de uma vez.
  async softDeleteGrupo(supabase: SupabaseClient, grupo: string) {
    const { error } = await supabase
      .from('transaction')
      .update({ ativo: false })
      .eq('parcela_grupo', grupo)
    if (error) throw new Error(error.message)
  },
}
