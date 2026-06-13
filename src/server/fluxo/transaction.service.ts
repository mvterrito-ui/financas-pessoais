import type { AuthContext } from '@/server/auth/context'
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

  create: (ctx: AuthContext, input: unknown) => {
    const { parcelas, ...values } = transactionCreateSchema.parse(input)

    // Compra parcelada: 'valor' é o total -> vira N lançamentos (1 por mês),
    // todos com o MESMO parcela_grupo pra dar pra ver/excluir juntos.
    if (parcelas && parcelas >= 2) {
      const grupo = crypto.randomUUID()
      const linhas = gerarParcelas(values.valor, parcelas, values.data).map((p) => ({
        tenant_id: ctx.tenantId,
        tipo: values.tipo,
        valor: p.valor,
        data: p.data,
        descricao: values.descricao ?? null,
        recorrente: false, // parcela não é gasto fixo recorrente
        category_id: values.category_id ?? null,
        account_id: values.account_id ?? null,
        parcela_grupo: grupo,
        parcela_num: p.num,
        parcela_total: parcelas,
      }))
      return transactionRepo
        .insertMany(ctx.supabase, linhas)
        .then(() => ({ parcelas: linhas.length, grupo }))
    }

    // À vista: um lançamento só (comportamento de sempre).
    return transactionRepo.create(ctx.supabase, {
      ...values,
      tenant_id: ctx.tenantId,
    })
  },

  update: (ctx: AuthContext, id: string, input: unknown) => {
    const values = transactionUpdateSchema.parse(input)
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
    const rows = novos.map((i) => ({
      tenant_id: ctx.tenantId,
      account_id: account_id ?? null,
      tipo: i.tipo,
      valor: i.valor,
      data: i.data,
      descricao: i.descricao,
      recorrente: false,
      origem: 'import',
      external_id: i.external_id ?? null,
    }))

    await transactionRepo.insertMany(ctx.supabase, rows)
    return { importados: rows.length, ignorados: itens.length - rows.length, total: itens.length }
  },
}
