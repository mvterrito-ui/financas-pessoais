import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from './crud'
import type { TransactionFilter } from './transaction.schema'

const base = makeRepo('transaction')

// Lista com filtros opcionais. Cada filtro vira um pedaço da query no banco.
// (Sem filtro de tenant: o RLS isola sozinho.)
export const transactionRepo = {
  ...base,
  async list(supabase: SupabaseClient, filtros: TransactionFilter = {}) {
    let query = supabase.from('transaction').select('*').eq('ativo', true)

    if (filtros.de) query = query.gte('data', filtros.de)
    if (filtros.ate) query = query.lte('data', filtros.ate)
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo)

    const { data, error } = await query.order('data', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },

  // Quais desses external_id já existem (pra não duplicar na importação).
  async existingExternalIds(supabase: SupabaseClient, ids: string[]) {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('transaction')
      .select('external_id')
      .in('external_id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []).map((d) => d.external_id as string)
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
