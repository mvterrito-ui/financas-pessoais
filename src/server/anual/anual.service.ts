import type { AuthContext } from '@/server/auth/context'
import { categoriaRepo, estruturaRepo, grupoRepo, itemRepo, valorRepo } from './anual.repo'
import { ErroHttp } from '@/server/erro'
import {
  categoriaCreateSchema,
  categoriaUpdateSchema,
  grupoCreateSchema,
  grupoUpdateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  valoresSetSchema,
} from './anual.schema'

const tenant = (ctx: AuthContext) => {
  if (!ctx.tenantId) throw new ErroHttp(403, 'Usuário sem conta vinculada')
  return ctx.tenantId
}

export const anualService = {
  estrutura: (ctx: AuthContext) => estruturaRepo.carregar(ctx.supabase),

  // ---- grupos
  criarGrupo: (ctx: AuthContext, input: unknown) =>
    grupoRepo.create(ctx.supabase, { ...grupoCreateSchema.parse(input), tenant_id: tenant(ctx) }),
  editarGrupo: (ctx: AuthContext, id: string, input: unknown) =>
    grupoRepo.update(ctx.supabase, id, grupoUpdateSchema.parse(input)),
  removerGrupo: (ctx: AuthContext, id: string) => grupoRepo.softDelete(ctx.supabase, id),

  // ---- categorias
  criarCategoria: (ctx: AuthContext, input: unknown) =>
    categoriaRepo.create(ctx.supabase, {
      ...categoriaCreateSchema.parse(input),
      tenant_id: tenant(ctx),
    }),
  editarCategoria: (ctx: AuthContext, id: string, input: unknown) =>
    categoriaRepo.update(ctx.supabase, id, categoriaUpdateSchema.parse(input)),
  removerCategoria: async (ctx: AuthContext, id: string) => {
    await estruturaRepo.soltarItensDaCategoria(ctx.supabase, id)
    await categoriaRepo.softDelete(ctx.supabase, id)
  },

  // ---- itens
  criarItem: (ctx: AuthContext, input: unknown) =>
    itemRepo.create(ctx.supabase, { ...itemCreateSchema.parse(input), tenant_id: tenant(ctx) }),
  editarItem: (ctx: AuthContext, id: string, input: unknown) =>
    itemRepo.update(ctx.supabase, id, itemUpdateSchema.parse(input)),
  removerItem: (ctx: AuthContext, id: string) => itemRepo.softDelete(ctx.supabase, id),

  // ---- valores
  valoresDoAno: (ctx: AuthContext, ano: number) => {
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroHttp(400, 'Ano inválido')
    return valorRepo.doAno(ctx.supabase, ano)
  },

  gravarValores: async (ctx: AuthContext, input: unknown) => {
    const { item_id, valores } = valoresSetSchema.parse(input)
    const t = tenant(ctx)
    const gravar = valores
      .filter((v) => v.valor !== null)
      .map((v) => ({ tenant_id: t, item_id, mes: v.mes, valor: v.valor }))
    const apagar = valores.filter((v) => v.valor === null).map((v) => v.mes)
    await Promise.all([
      valorRepo.gravar(ctx.supabase, gravar),
      valorRepo.apagar(ctx.supabase, item_id, apagar),
    ])
    return { ok: true }
  },
}
