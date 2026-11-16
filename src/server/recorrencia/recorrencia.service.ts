import { exigirTenant, type AuthContext } from '@/server/auth/context'
import { ErroHttp } from '@/server/erro'
import { transactionRepo } from '@/server/fluxo/transaction.repo'
import { recorrenciaDados, recorrenciaRepo } from './recorrencia.repo'
import {
  confirmarSchema,
  recorrenciaAcaoSchema,
  recorrenciaCreateSchema,
  recorrenciaUpdateSchema,
} from './recorrencia.schema'
import { aconteceEm, pausaQueCobre, previstosDoMes, type AjusteValor, type Pausa, type Recorrencia } from './recorrencia.calc'
import { validarVinculos } from '@/server/anual/plano'

const tenant = exigirTenant

const mesAnterior = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`
}

export const recorrenciaService = {
  listar: (ctx: AuthContext) => recorrenciaDados.tudo(ctx.supabase),

  criar: async (ctx: AuthContext, input: unknown) => {
    const values = recorrenciaCreateSchema.parse(input)
    await validarVinculos(ctx.supabase, values, values.tipo)
    return recorrenciaRepo.create(ctx.supabase, { ...values, tenant_id: tenant(ctx) })
  },

  editar: async (ctx: AuthContext, id: string, input: unknown) => {
    const values = recorrenciaUpdateSchema.parse(input)
    const atual = (await recorrenciaRepo.getById(ctx.supabase, id)) as Recorrencia
    // Regras que dependem do registro inteiro (o PATCH pode mandar só um campo).
    const inicio = values.inicio ?? atual.inicio.slice(0, 10)
    const fim = values.fim === undefined ? atual.fim?.slice(0, 10) : values.fim
    if (fim && fim < inicio) throw new ErroHttp(400, 'O fim não pode ser antes do início')
    await validarVinculos(ctx.supabase, values, values.tipo ?? atual.tipo)
    return recorrenciaRepo.update(ctx.supabase, id, values)
  },

  // Os lançamentos já confirmados continuam (só param as próximas previsões).
  remover: (ctx: AuthContext, id: string) => recorrenciaRepo.softDelete(ctx.supabase, id),

  acao: async (ctx: AuthContext, id: string, input: unknown) => {
    const a = recorrenciaAcaoSchema.parse(input)
    const sb = ctx.supabase
    const [rec, pausas] = (await Promise.all([
      recorrenciaRepo.getById(sb, id),
      recorrenciaDados.pausasDe(sb, id),
    ])) as [Recorrencia, Pausa[]]
    const t = tenant(ctx)

    switch (a.acao) {
      case 'pausar':
        if (a.ate && a.ate < a.mes) throw new ErroHttp(400, 'O retorno não pode ser antes do início da pausa')
        if (pausaQueCobre(rec, pausas, a.mes)) throw new ErroHttp(400, 'Já está pausada nesse mês')
        return recorrenciaDados.inserirPausa(sb, { tenant_id: t, recorrencia_id: id, de: a.mes, ate: a.ate ?? null })
      case 'pular':
        if (pausaQueCobre(rec, pausas, a.mes)) throw new ErroHttp(400, 'Esse mês já está pausado')
        return recorrenciaDados.inserirPausa(sb, { tenant_id: t, recorrencia_id: id, de: a.mes, ate: a.mes })
      case 'retomar': {
        // Volta a valer a partir de `mes`: a pausa que cobre o mês termina no anterior.
        const p = pausaQueCobre(rec, pausas, a.mes)
        if (!p) throw new ErroHttp(400, 'Não está pausada nesse mês')
        const fim = mesAnterior(a.mes)
        return fim < p.de.slice(0, 10)
          ? recorrenciaDados.removerPausa(sb, p.id)
          : recorrenciaDados.atualizarPausa(sb, p.id, { ate: fim })
      }
      case 'finalizar':
        if (a.mes < rec.inicio.slice(0, 10)) throw new ErroHttp(400, 'O último mês não pode ser antes do início')
        return recorrenciaRepo.update(sb, id, { fim: a.mes })
      case 'reativar':
        return recorrenciaRepo.update(sb, id, { fim: null })
      case 'reajustar':
        return recorrenciaDados.gravarAjuste(sb, { tenant_id: t, recorrencia_id: id, a_partir: a.mes, valor: a.valor })
    }
  },

  // Confirma a previsão do mês: vira um lançamento de verdade.
  confirmar: async (ctx: AuthContext, id: string, input: unknown) => {
    const c = confirmarSchema.parse(input)
    const [rec, pausas] = (await Promise.all([
      recorrenciaRepo.getById(ctx.supabase, id),
      recorrenciaDados.pausasDe(ctx.supabase, id),
    ])) as [Recorrencia & { ativo: boolean }, Pausa[]]
    if (!rec.ativo) throw new ErroHttp(400, 'Essa recorrência foi excluída')
    if (!aconteceEm(rec, pausas, c.mes)) throw new ErroHttp(400, 'Essa recorrência não acontece nesse mês (pausada ou fora do período)')
    if (c.budget_id) await validarVinculos(ctx.supabase, { budget_id: c.budget_id }, rec.tipo)
    try {
      return await transactionRepo.create(ctx.supabase, {
        tenant_id: tenant(ctx),
        tipo: rec.tipo,
        valor: c.valor,
        moeda: rec.moeda,
        data: c.data,
        descricao: rec.descricao,
        item_id: rec.item_id,
        budget_id: c.budget_id === undefined ? rec.budget_id : c.budget_id,
        recorrencia_id: rec.id,
        competencia: c.mes,
        origem: 'manual',
      })
    } catch (e) {
      if (/duplicate key|transaction_recorrencia_mes_idx/i.test((e as Error).message))
        throw new ErroHttp(409, 'Esse mês já foi confirmado')
      throw e
    }
  },

  previstos: async (ctx: AuthContext, mes: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(mes)) throw new ErroHttp(400, 'Mês inválido')
    const [{ recorrencias, pausas, ajustes }, confirmacoes] = await Promise.all([
      recorrenciaDados.tudo(ctx.supabase),
      recorrenciaDados.confirmacoesDoMes(ctx.supabase, mes),
    ])
    return previstosDoMes(
      recorrencias as Recorrencia[],
      pausas as Pausa[],
      ajustes as AjusteValor[],
      confirmacoes,
      mes,
    )
  },
}
