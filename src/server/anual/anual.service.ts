import { exigirTenant, type AuthContext } from '@/server/auth/context'
import { categoriaRepo, estruturaRepo, lancamentoRepo, grupoRepo, itemRepo, valorRepo } from './anual.repo'
import { soltarCategorias } from './plano'
import { ok } from '@/server/fluxo/crud'
import { ErroHttp } from '@/server/erro'
import { recorrenciaDados } from '@/server/recorrencia/recorrencia.repo'
import { planejadoDoAno, type AjusteValor, type Pausa, type Recorrencia } from '@/server/recorrencia/recorrencia.calc'
import {
  categoriaCreateSchema,
  categoriaUpdateSchema,
  grupoCreateSchema,
  grupoUpdateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  valoresSetSchema,
} from './anual.schema'

const tenant = exigirTenant

export const anualService = {
  estrutura: (ctx: AuthContext) => estruturaRepo.carregar(ctx.supabase),

  // ---- grupos
  criarGrupo: (ctx: AuthContext, input: unknown) =>
    grupoRepo.create(ctx.supabase, { ...grupoCreateSchema.parse(input), tenant_id: tenant(ctx) }),
  editarGrupo: (ctx: AuthContext, id: string, input: unknown) =>
    grupoRepo.update(ctx.supabase, id, grupoUpdateSchema.parse(input)),
  // Remove o grupo COM as categorias e subgrupos dele; lançamentos e
  // recorrências dessas categorias ficam sem categoria (aparecem no aviso).
  removerGrupo: async (ctx: AuthContext, id: string) => {
    const sb = ctx.supabase
    const itens = ok(await sb.from('annual_item').select('id').eq('group_id', id)) as { id: string }[]
    await soltarCategorias(sb, itens.map((i) => i.id))
    await Promise.all([
      sb.from('annual_item').update({ ativo: false }).eq('group_id', id).then(ok),
      sb.from('annual_category').update({ ativo: false }).eq('group_id', id).then(ok),
    ])
    await grupoRepo.softDelete(sb, id)
  },

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
  removerItem: async (ctx: AuthContext, id: string) => {
    await soltarCategorias(ctx.supabase, [id])
    await itemRepo.softDelete(ctx.supabase, id)
  },

  // ---- valores
  valoresDoAno: (ctx: AuthContext, ano: number) => {
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroHttp(400, 'Ano inválido')
    return valorRepo.doAno(ctx.supabase, ano)
  },

  /**
   * O ano visto pelos lançamentos e recorrências:
   *  - realizado: soma dos lançamentos por (categoria, mês, moeda), pelo mês
   *    da DATA do lançamento (igual a Lançamentos, Visão geral e Relatórios);
   *  - previsto: o que as recorrências preveem por (categoria, mês, moeda);
   *  - semCategoria: lançamentos do ano sem categoria ativa no plano (sem
   *    categoria ou de categoria/grupo removido), pra avisar na tela.
   * A conversão pra real é feita no app, com a cotação ao vivo.
   */
  realizadoDoAno: async (ctx: AuthContext, ano: number) => {
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroHttp(400, 'Ano inválido')
    const [lancs, { recorrencias, pausas, ajustes }, estrutura] = await Promise.all([
      lancamentoRepo.doAno(ctx.supabase, ano),
      recorrenciaDados.tudo(ctx.supabase),
      estruturaRepo.carregar(ctx.supabase),
    ])
    const gruposAtivos = new Set((estrutura.grupos as { id: string }[]).map((g) => g.id))
    const ativos = new Set(
      (estrutura.itens as { id: string; group_id: string }[])
        .filter((i) => gruposAtivos.has(i.group_id))
        .map((i) => i.id),
    )
    const realizado = new Map<string, { item_id: string; mes: string; moeda: string; valor: number }>()
    const semCategoria = new Map<string, { moeda: string; valor: number; qtd: number }>()
    for (const l of lancs) {
      const moeda = l.moeda ?? 'BRL'
      if (!l.item_id || !ativos.has(l.item_id)) {
        const s = semCategoria.get(moeda) ?? { moeda, valor: 0, qtd: 0 }
        s.valor += Number(l.valor)
        s.qtd += 1
        semCategoria.set(moeda, s)
        continue
      }
      const mes = `${l.data.slice(0, 7)}-01`
      const k = `${l.item_id}|${mes}|${moeda}`
      const p = realizado.get(k) ?? { item_id: l.item_id, mes, moeda, valor: 0 }
      p.valor += Number(l.valor)
      realizado.set(k, p)
    }
    return {
      realizado: [...realizado.values()],
      previsto: planejadoDoAno(
        (recorrencias as Recorrencia[]).filter((r) => !r.item_id || ativos.has(r.item_id)),
        pausas as Pausa[],
        ajustes as AjusteValor[],
        ano,
      ),
      semCategoria: [...semCategoria.values()],
    }
  },

  gravarValores: async (ctx: AuthContext, input: unknown) => {
    const { item_id, valores } = valoresSetSchema.parse(input)
    const t = tenant(ctx)
    await itemRepo.getById(ctx.supabase, item_id) // a categoria tem que ser deste usuário
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
