import type { SupabaseClient } from '@supabase/supabase-js'
import { ErroHttp } from '@/server/erro'
import { ok } from '@/server/fluxo/crud'
import { budgetRepo } from '@/server/orcamento/budget.repo'
import { grupoRepo, itemRepo } from './anual.repo'

// Regras de vínculo usadas por lançamentos e recorrências.
//
// A FK do banco NÃO passa pelo RLS: sem checar, daria pra apontar pra
// categoria/fatia de outro usuário. getById passa pelo RLS (erro se não for dele).

/** Categoria existe, está ativa e combina com o tipo (entrada = receita). */
export async function validarCategoria(sb: SupabaseClient, itemId: string, tipo: 'entrada' | 'saida') {
  const item = await itemRepo.getById(sb, itemId)
  const grupo = await grupoRepo.getById(sb, item.group_id)
  if (!item.ativo || !grupo.ativo) throw new ErroHttp(400, 'Essa categoria foi removida')
  const combina = tipo === 'entrada' ? grupo.tipo === 'receita' : grupo.tipo !== 'receita'
  if (!combina)
    throw new ErroHttp(
      400,
      tipo === 'entrada'
        ? 'Entrada precisa de uma categoria de receita'
        : 'Saída precisa de uma categoria de despesa ou investimento',
    )
}

/** Fatia do Orçamento: é do usuário, está ativa e só vale pra saída. */
export async function validarFatia(sb: SupabaseClient, budgetId: string, tipo: 'entrada' | 'saida') {
  if (tipo === 'entrada') throw new ErroHttp(400, 'Só saídas usam fatia do orçamento')
  const fatia = await budgetRepo.getById(sb, budgetId)
  if (!fatia.ativo) throw new ErroHttp(400, 'Essa fatia foi removida')
}

/** Valida o que vier preenchido (null/undefined = sem categoria/fatia). */
export async function validarVinculos(
  sb: SupabaseClient,
  v: { item_id?: string | null; budget_id?: string | null },
  tipo: 'entrada' | 'saida',
) {
  await Promise.all([
    v.item_id ? validarCategoria(sb, v.item_id, tipo) : null,
    v.budget_id ? validarFatia(sb, v.budget_id, tipo) : null,
  ])
}

/** Ao remover categorias do plano, os lançamentos e recorrências delas ficam sem categoria. */
export async function soltarCategorias(sb: SupabaseClient, itemIds: string[]) {
  if (itemIds.length === 0) return
  await Promise.all([
    sb.from('transaction').update({ item_id: null }).in('item_id', itemIds).then(ok),
    sb.from('recorrencia').update({ item_id: null }).in('item_id', itemIds).then(ok),
  ])
}
