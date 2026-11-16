import type { SupabaseClient } from '@supabase/supabase-js'
import { ErroHttp } from '@/server/erro'
import { accountRepo } from '@/server/fluxo/account.repo'
import { ok } from '@/server/fluxo/crud'
import { grupoRepo, itemRepo } from './anual.repo'

// Regras do plano de contas usadas por lançamentos e recorrências.
//
// A FK do banco NÃO passa pelo RLS: sem checar, daria pra apontar pra
// categoria/conta de outro usuário. getById passa pelo RLS (404 se não for dele).

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

export async function validarConta(sb: SupabaseClient, accountId: string) {
  await accountRepo.getById(sb, accountId)
}

/** Valida o que vier preenchido (null/undefined = sem categoria/conta). */
export async function validarVinculos(
  sb: SupabaseClient,
  v: { item_id?: string | null; account_id?: string | null },
  tipo: 'entrada' | 'saida',
) {
  await Promise.all([
    v.item_id ? validarCategoria(sb, v.item_id, tipo) : null,
    v.account_id ? validarConta(sb, v.account_id) : null,
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
