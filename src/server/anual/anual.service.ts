import type { AuthContext } from '@/server/auth/context'
import { categoriaRepo, estruturaRepo, fluxoRepo, grupoRepo, itemRepo, valorRepo } from './anual.repo'
import { ErroHttp } from '@/server/erro'
import { transactionRepo } from '@/server/fluxo/transaction.repo'
import { repeticoesRecorrentes, type Transaction } from '@/server/fluxo/fluxo.calc'
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

  /**
   * O que vem do Fluxo de Caixa no ano, já agregado:
   *  - porItem: soma por (item ligado, mês, moeda) — a conversão pra real é
   *    feita no app com a cotação ao vivo, igual ao resto do Fluxo;
   *  - semLigacao: lançamentos do ano cujas categorias não estão ligadas
   *    (ou sem categoria), pra avisar o que está ficando de fora.
   */
  fluxoDoAno: async (ctx: AuthContext, ano: number) => {
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroHttp(400, 'Ano inválido')
    const [ligadas, reais, modelos] = await Promise.all([
      fluxoRepo.categoriasLigadas(ctx.supabase),
      fluxoRepo.lancamentosDoAno(ctx.supabase, ano),
      transactionRepo.recorrentes(ctx.supabase, `${ano}-01-01`, `${ano}-12-31`),
    ])
    // + repetições dos gastos fixos no ano (inclusive meses futuros: previsão)
    const lancs = [
      ...reais,
      ...repeticoesRecorrentes(modelos as Transaction[], `${ano}-01-01`, `${ano}-12-31`),
    ]
    const itemDaCategoria = new Map(ligadas.map((c) => [c.id, c.annual_item_id]))
    const porItem = new Map<string, { item_id: string; mes: string; moeda: string; valor: number }>()
    const semLigacao = new Map<string, { moeda: string; valor: number; qtd: number }>()
    for (const l of lancs) {
      const moeda = l.moeda ?? 'BRL'
      const item = l.category_id ? itemDaCategoria.get(l.category_id) : undefined
      if (!item) {
        const s = semLigacao.get(moeda) ?? { moeda, valor: 0, qtd: 0 }
        s.valor += Number(l.valor)
        s.qtd += 1
        semLigacao.set(moeda, s)
        continue
      }
      const mes = `${l.data.slice(0, 7)}-01`
      const k = `${item}|${mes}|${moeda}`
      const p = porItem.get(k) ?? { item_id: item, mes, moeda, valor: 0 }
      p.valor += Number(l.valor)
      porItem.set(k, p)
    }
    return { porItem: [...porItem.values()], semLigacao: [...semLigacao.values()] }
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
