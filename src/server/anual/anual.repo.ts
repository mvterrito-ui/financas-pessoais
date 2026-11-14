import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo } from '@/server/fluxo/crud'

// O repo NUNCA filtra por tenant: o supabase traz a sessão e o RLS isola.
export const grupoRepo = makeRepo('annual_group')
export const categoriaRepo = makeRepo('annual_category')
export const itemRepo = makeRepo('annual_item')

function ok<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

const ativosEmOrdem = (sb: SupabaseClient, tabela: string) =>
  sb
    .from(tabela)
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

export const estruturaRepo = {
  async carregar(sb: SupabaseClient) {
    const [grupos, categorias, itens] = await Promise.all([
      ativosEmOrdem(sb, 'annual_group').then(ok),
      ativosEmOrdem(sb, 'annual_category').then(ok),
      ativosEmOrdem(sb, 'annual_item').then(ok),
    ])
    return { grupos, categorias, itens }
  },

  // Ao remover uma categoria, os itens dela ficam direto no grupo.
  async soltarItensDaCategoria(sb: SupabaseClient, categoryId: string) {
    ok(await sb.from('annual_item').update({ category_id: null }).eq('category_id', categoryId))
  },
}

export const valorRepo = {
  async doAno(sb: SupabaseClient, ano: number) {
    return ok(
      await sb
        .from('annual_value')
        .select('item_id, mes, valor')
        .gte('mes', `${ano}-01-01`)
        .lte('mes', `${ano}-12-01`),
    )
  },

  async gravar(sb: SupabaseClient, linhas: Record<string, unknown>[]) {
    if (linhas.length)
      ok(await sb.from('annual_value').upsert(linhas, { onConflict: 'item_id,mes' }))
  },

  async apagar(sb: SupabaseClient, itemId: string, meses: string[]) {
    if (meses.length)
      ok(await sb.from('annual_value').delete().eq('item_id', itemId).in('mes', meses))
  },
}
