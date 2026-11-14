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

/**
 * Busca TODAS as linhas, página por página. O Supabase limita cada resposta
 * (max_rows, 1000 por padrão) e corta o resto em silêncio — listas grandes
 * (histórico importado, anos de patrimônio) saíam incompletas.
 * `consulta(de, ate)` deve aplicar .range(de, ate) e uma ordem ESTÁVEL.
 */
export async function buscarTudo<T = Record<string, unknown>>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pagina = 1000,
): Promise<T[]> {
  const tudo: T[] = []
  for (let de = 0; ; de += pagina) {
    const { data, error } = await consulta(de, de + pagina - 1)
    if (error) throw new Error(error.message)
    tudo.push(...(data ?? []))
    if (!data || data.length < pagina) return tudo
  }
}
