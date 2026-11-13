import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthContext } from '@/server/auth/context'
import { precosB3 } from '@/server/cotacao'
import { fiiRepo } from '@/server/fii/fii.repo'
import { acaoRepo } from '@/server/acao/acao.repo'
import { fixedIncomeRepo } from '@/server/renda-fixa/fixed-income.repo'
import { cryptoRepo } from '@/server/cripto/crypto.repo'
import { totais as carteiraTotais, type Fii } from '@/server/fii/fii.calc'
import { totais as rfTotais, type FixedIncome } from '@/server/renda-fixa/renda-fixa.calc'
import { valorAtual as criptoValor, type CryptoSummary } from '@/server/cripto/cripto.calc'
import { snapshotRepo } from './snapshot.repo'
import { ORIGENS, type Origem } from './patrimonio.calc'

// Garante que os 4 lugares automáticos existem (cria na 1ª vez).
// unique (tenant_id, origem) + ignoreDuplicates => seguro em chamadas paralelas.
async function garantirLugares(ctx: AuthContext) {
  const linhas = ORIGENS.map((o, i) => ({
    tenant_id: ctx.tenantId,
    origem: o.origem,
    name: o.nome,
    moeda: o.moeda,
    ordem: i - ORIGENS.length, // negativos: aparecem antes dos manuais
  }))
  const { error } = await ctx.supabase
    .from('wealth_place')
    .upsert(linhas, { onConflict: 'tenant_id,origem', ignoreDuplicates: true })
  if (error) throw new Error(error.message)

  const { data, error: e2 } = await ctx.supabase
    .from('wealth_place')
    .select('id, origem')
    .not('origem', 'is', null)
  if (e2) throw new Error(e2.message)
  return Object.fromEntries(data.map((p) => [p.origem, p.id])) as Record<Origem, string>
}

// Valor atual de cada módulo, na moeda do lugar (cripto em US$, resto em R$).
async function valoresAtuais(supabase: SupabaseClient): Promise<Record<Origem, number>> {
  const [fiis, acoes, rf, cripto] = await Promise.all([
    fiiRepo.list(supabase) as Promise<Fii[]>,
    acaoRepo.list(supabase) as Promise<Fii[]>,
    fixedIncomeRepo.list(supabase) as Promise<FixedIncome[]>,
    cryptoRepo.list(supabase) as Promise<CryptoSummary[]>,
  ])
  const quotes = await precosB3([...fiis, ...acoes].map((f) => f.ticker))
  return {
    acao: carteiraTotais(acoes, quotes).atual,
    fii: carteiraTotais(fiis, quotes).atual,
    renda_fixa: rfTotais(rf).atual,
    cripto: criptoValor(cripto),
  }
}

const centavos = (n: number) => Math.round(Math.max(0, n) * 100) / 100

/**
 * Grava a foto do mês (AAAA-MM-01) dos lugares automáticos com o valor
 * atual de cada módulo. Só faz sentido pro mês corrente: os módulos guardam
 * a posição de HOJE, então meses passados ficam com a última foto gravada.
 */
export async function sincronizarInvestimentos(ctx: AuthContext, mes: string) {
  if (!/^\d{4}-\d{2}-01$/.test(mes)) throw new Error('Mês inválido (use AAAA-MM-01)')
  const [ids, valores] = await Promise.all([garantirLugares(ctx), valoresAtuais(ctx.supabase)])
  await Promise.all(
    ORIGENS.map((o) =>
      snapshotRepo.upsert(ctx.supabase, {
        tenant_id: ctx.tenantId,
        place_id: ids[o.origem],
        mes,
        valor: centavos(valores[o.origem]),
      }),
    ),
  )
  return { ok: true }
}
