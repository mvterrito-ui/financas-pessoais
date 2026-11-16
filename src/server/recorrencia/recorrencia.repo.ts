import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRepo, ok } from '@/server/fluxo/crud'

// O repo não filtra por tenant: o RLS isola.
export const recorrenciaRepo = makeRepo('recorrencia')


export const recorrenciaDados = {
  async tudo(sb: SupabaseClient) {
    const [recorrencias, pausas, ajustes] = await Promise.all([
      sb.from('recorrencia').select('*').eq('ativo', true).order('dia').order('descricao').then(ok),
      sb.from('recorrencia_pausa').select('id, recorrencia_id, de, ate').order('de').then(ok),
      sb.from('recorrencia_valor').select('id, recorrencia_id, a_partir, valor').order('a_partir').then(ok),
    ])
    return { recorrencias, pausas, ajustes }
  },

  async confirmacoesDoMes(sb: SupabaseClient, mes: string) {
    return ok(
      await sb
        .from('transaction')
        .select('recorrencia_id, competencia')
        .eq('ativo', true)
        .eq('competencia', mes)
        .not('recorrencia_id', 'is', null),
    ) as { recorrencia_id: string; competencia: string }[]
  },

  async pausasDe(sb: SupabaseClient, recorrenciaId: string) {
    return ok(
      await sb.from('recorrencia_pausa').select('id, recorrencia_id, de, ate').eq('recorrencia_id', recorrenciaId),
    )
  },

  async inserirPausa(sb: SupabaseClient, values: Record<string, unknown>) {
    ok(await sb.from('recorrencia_pausa').insert(values))
  },
  async atualizarPausa(sb: SupabaseClient, id: string, values: Record<string, unknown>) {
    ok(await sb.from('recorrencia_pausa').update(values).eq('id', id))
  },
  async removerPausa(sb: SupabaseClient, id: string) {
    ok(await sb.from('recorrencia_pausa').delete().eq('id', id))
  },
  async gravarAjuste(sb: SupabaseClient, values: Record<string, unknown>) {
    ok(await sb.from('recorrencia_valor').upsert(values, { onConflict: 'recorrencia_id,a_partir' }))
  },
}
