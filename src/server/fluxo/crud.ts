import type { SupabaseClient } from '@supabase/supabase-js'

// Fábrica de repo. Toda entidade do fluxo fala com o banco do MESMO jeito,
// então em vez de copiar/colar o mesmo CRUD 3x, a gente fabrica.
//
// REGRA DE OURO: o repo NUNCA filtra por tenant. O supabase aqui já carrega
// a sessão do usuário, e o RLS do banco isola por tenant sozinho.
export function makeRepo(table: string) {
  return {
    async list(supabase: SupabaseClient, orderBy = 'created_at') {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('ativo', true)
        .order(orderBy, { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },

    async getById(supabase: SupabaseClient, id: string) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)
      return data
    },

    async create(supabase: SupabaseClient, values: Record<string, unknown>) {
      const { data, error } = await supabase
        .from(table)
        .insert(values)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },

    async update(supabase: SupabaseClient, id: string, values: Record<string, unknown>) {
      const { data, error } = await supabase
        .from(table)
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },

    // Soft delete: marca ativo = false, não apaga de verdade.
    async softDelete(supabase: SupabaseClient, id: string) {
      const { error } = await supabase
        .from(table)
        .update({ ativo: false })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  }
}
