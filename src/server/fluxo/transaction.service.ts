import { exigirTenant, type AuthContext } from '@/server/auth/context'
import { validarVinculos } from '@/server/anual/plano'
import { recorrenciaRepo } from '@/server/recorrencia/recorrencia.repo'
import { transactionRepo } from './transaction.repo'
import {
  transactionCreateSchema,
  transactionFilterSchema,
  transactionUpdateSchema,
} from './transaction.schema'
import { statementImportSchema } from './statement.schema'
import { gerarParcelas } from './fluxo.calc'

// O service é a regra de negócio: valida com o Zod e CARIMBA o tenant_id no
// create (o usuário nunca escolhe o tenant — ele vem do login).
export const transactionService = {
  list: (ctx: AuthContext, filtros: unknown = {}) => {
    const f = transactionFilterSchema.parse(filtros)
    return transactionRepo.list(ctx.supabase, f)
  },

  getById: (ctx: AuthContext, id: string) =>
    transactionRepo.getById(ctx.supabase, id),

  create: async (ctx: AuthContext, input: unknown) => {
    const { parcelas, repetir, ...values } = transactionCreateSchema.parse(input)
    const tenant = exigirTenant(ctx)
    await validarVinculos(ctx.supabase, values, values.tipo)

    // Compra parcelada: 'valor' é o total -> vira N lançamentos (1 por mês),
    // todos com o MESMO parcela_grupo pra dar pra ver/excluir juntos.
    if (parcelas && parcelas >= 2) {
      const grupo = crypto.randomUUID()
      const linhas = gerarParcelas(values.valor, parcelas, values.data).map((p) => ({
        tenant_id: tenant,
        tipo: values.tipo,
        valor: p.valor,
        moeda: values.moeda,
        data: p.data,
        descricao: values.descricao ?? null,
        item_id: values.item_id ?? null,
        account_id: values.account_id ?? null,
        parcela_grupo: grupo,
        parcela_num: p.num,
        parcela_total: parcelas,
      }))
      await transactionRepo.insertMany(ctx.supabase, linhas)
      return { parcelas: linhas.length, grupo }
    }

    const competencia = `${values.data.slice(0, 7)}-01`
    const criado = (await transactionRepo.create(ctx.supabase, { ...values, tenant_id: tenant })) as { id: string }
    if (!repetir) return criado

    // "Repetir todo mês": recorrência + vínculo deste lançamento como 1º mês,
    // tudo no servidor. Se a recorrência falhar, desfaz o lançamento (sem
    // deixar meio feito nem duplicar ao tentar de novo).
    try {
      const rec = (await recorrenciaRepo.create(ctx.supabase, {
        tenant_id: tenant,
        tipo: values.tipo,
        descricao: values.descricao || (values.tipo === 'entrada' ? 'Receita fixa' : 'Despesa fixa'),
        valor: values.valor,
        moeda: values.moeda,
        item_id: values.item_id ?? null,
        account_id: values.account_id ?? null,
        dia: Number(values.data.slice(8, 10)),
        inicio: competencia,
      })) as { id: string }
      return await transactionRepo.update(ctx.supabase, criado.id, { recorrencia_id: rec.id, competencia })
    } catch (e) {
      await transactionRepo.softDelete(ctx.supabase, criado.id)
      throw e
    }
  },

  update: async (ctx: AuthContext, id: string, input: unknown) => {
    const values = transactionUpdateSchema.parse(input)
    if (values.item_id || values.account_id) {
      // Tipo final (o enviado ou o atual) pra conferir se a categoria combina.
      const tipo = values.tipo ?? ((await transactionRepo.getById(ctx.supabase, id)) as { tipo: 'entrada' | 'saida' }).tipo
      await validarVinculos(ctx.supabase, values, tipo)
    }
    return transactionRepo.update(ctx.supabase, id, values)
  },

  softDelete: (ctx: AuthContext, id: string) =>
    transactionRepo.softDelete(ctx.supabase, id),

  // Apaga a compra parcelada inteira (todas as parcelas do grupo). O RLS
  // garante que só apaga grupos do próprio tenant.
  softDeleteGrupo: (ctx: AuthContext, grupo: string) =>
    transactionRepo.softDeleteGrupo(ctx.supabase, grupo),

  // Importa itens já parseados de uma fatura/extrato, sem duplicar (external_id).
  async importStatement(ctx: AuthContext, input: unknown) {
    const { account_id, itens } = statementImportSchema.parse(input)

    const ids = itens.map((i) => i.external_id).filter((x): x is string => Boolean(x))
    const existentes = new Set(await transactionRepo.existingExternalIds(ctx.supabase, ids))

    const novos = itens.filter((i) => !i.external_id || !existentes.has(i.external_id))
    const tenant = exigirTenant(ctx)
    if (account_id) await validarVinculos(ctx.supabase, { account_id }, 'saida')
    const rows = novos.map((i) => ({
      tenant_id: tenant,
      account_id: account_id ?? null,
      tipo: i.tipo,
      valor: i.valor,
      data: i.data,
      descricao: i.descricao,
      origem: 'import',
      external_id: i.external_id ?? null,
    }))

    await transactionRepo.insertMany(ctx.supabase, rows)
    return { importados: rows.length, ignorados: itens.length - rows.length, total: itens.length }
  },
}
