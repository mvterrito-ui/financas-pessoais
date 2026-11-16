import type { SupabaseClient } from '@supabase/supabase-js'
import { precosB3 } from '@/server/cotacao'
import { ok } from '@/server/fluxo/crud'
import { totais as carteiraTotais, type Fii } from '@/server/fii/fii.calc'
import { totais as rfTotais, type FixedIncome } from '@/server/renda-fixa/renda-fixa.calc'
import { valorAtual as criptoValor, type CryptoSummary } from '@/server/cripto/cripto.calc'
import { pagoEstimado, type Consorcio, type Reajuste } from '@/server/consorcio/consorcio.calc'
import { ORIGENS, mesAtualBR, type Origem } from './patrimonio.calc'

// Sincronização mensal do Patrimônio. Roda em DOIS contextos:
//  - pelo usuário logado (cliente com RLS), ao abrir Patrimônio/Visão geral;
//  - pelo cron diário (cliente ADMIN, que fura o RLS).
// Por isso TODA consulta aqui filtra por tenant_id explicitamente — no
// contexto admin é isso (e não o RLS) que isola um usuário do outro.

const centavos = (n: number) => Math.round(Math.max(0, n) * 100) / 100


// Garante os 4 lugares automáticos do tenant (cria na 1ª vez).
// unique (tenant_id, origem) + ignoreDuplicates => seguro em chamadas paralelas.
async function garantirLugares(sb: SupabaseClient, tenantId: string) {
  ok(
    await sb.from('wealth_place').upsert(
      ORIGENS.map((o, i) => ({
        tenant_id: tenantId,
        origem: o.origem,
        name: o.nome,
        moeda: o.moeda,
        ordem: i - ORIGENS.length, // negativos: aparecem antes dos manuais
      })),
      { onConflict: 'tenant_id,origem', ignoreDuplicates: true },
    ),
  )
  const lugares = ok(
    await sb
      .from('wealth_place')
      .select('id, origem')
      .eq('tenant_id', tenantId)
      .not('origem', 'is', null),
  ) as { id: string; origem: Origem }[]
  return Object.fromEntries(lugares.map((p) => [p.origem, p.id])) as Record<Origem, string>
}

// Valor de hoje de cada módulo, na moeda do lugar (cripto em US$, resto em R$).
async function valoresAtuais(
  sb: SupabaseClient,
  tenantId: string,
): Promise<Record<Origem, number | null>> {
  const ativos = (tabela: string) =>
    sb.from(tabela).select('*').eq('tenant_id', tenantId).eq('ativo', true)
  const [fiis, acoes, rf, cripto, consorcios, reajustes] = await Promise.all([
    ativos('fii').then(ok) as Promise<Fii[]>,
    ativos('acao').then(ok) as Promise<Fii[]>,
    ativos('fixed_income').then(ok) as Promise<FixedIncome[]>,
    sb.from('crypto_summary').select('*').eq('tenant_id', tenantId).then(ok) as Promise<CryptoSummary[]>,
    ativos('consorcio').then(ok) as Promise<Consorcio[]>,
    sb
      .from('consorcio_reajuste')
      .select('id, consorcio_id, a_partir_parcela, valor_parcela')
      .eq('tenant_id', tenantId)
      .then(ok) as Promise<Reajuste[]>,
  ])
  const quotes = await precosB3([...fiis, ...acoes].map((f) => f.ticker))
  // Se faltou cotação de alguma posição (Yahoo fora/limite), o cálculo cairia
  // no preço médio e SOBRESCREVERIA a foto do mês com um valor errado. Nesse
  // caso a origem fica de fora (null) e a última foto boa é mantida.
  const semCotacao = (lista: Fii[]) =>
    lista.some((f) => Number(f.quantidade) > 0 && quotes[f.ticker.toUpperCase()] === undefined)
  return {
    acao: semCotacao(acoes) ? null : carteiraTotais(acoes, quotes).atual,
    fii: semCotacao(fiis) ? null : carteiraTotais(fiis, quotes).atual,
    renda_fixa: rfTotais(rf).atual,
    cripto: criptoValor(cripto),
    // Encerrado = a carta já virou o bem (que, se for o caso, entra como bem manual).
    consorcio: consorcios
      .filter((c) => c.status !== 'encerrado')
      .reduce((s, c) => s + pagoEstimado(c, reajustes), 0),
  }
}

// Bens MANUAIS sem valor no mês: copia o último valor de meses anteriores
// (você só ajusta o que mudou). Quem já tem valor no mês — mesmo 0 — fica.
async function carregarManuais(sb: SupabaseClient, tenantId: string, mes: string) {
  const manuais = ok(
    await sb
      .from('wealth_place')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .is('origem', null),
  ) as { id: string }[]
  // Inclui os ocultos: ocultar só tira da lista, o valor continua contando.
  if (manuais.length === 0) return 0

  const snaps = ok(
    await sb
      .from('wealth_snapshot')
      .select('place_id, mes, valor')
      .eq('tenant_id', tenantId)
      .in('place_id', manuais.map((p) => p.id))
      .lte('mes', mes)
      .order('mes', { ascending: false }),
  ) as { place_id: string; mes: string; valor: number | string }[]

  const novos = manuais.flatMap(({ id }) => {
    const doLugar = snaps.filter((s) => s.place_id === id) // já em ordem decrescente
    if (doLugar.length === 0 || doLugar[0].mes.slice(0, 10) === mes) return []
    return [{ tenant_id: tenantId, place_id: id, mes, valor: Number(doLugar[0].valor) }]
  })
  if (novos.length) {
    // ignoreDuplicates: se o usuário salvou nesse meio-tempo, vale o dele.
    ok(await sb.from('wealth_snapshot').upsert(novos, { onConflict: 'place_id,mes', ignoreDuplicates: true }))
  }
  return novos.length
}

/**
 * Grava a foto do MÊS ATUAL (horário de Brasília) do tenant:
 *  - investimentos: valor de hoje de cada módulo (sobrescreve — a última
 *    sincronização do mês vira o fechamento);
 *  - bens manuais sem valor no mês: copia o último valor conhecido.
 */
export async function sincronizarMes(sb: SupabaseClient, tenantId: string) {
  const mes = mesAtualBR()
  const [ids, valores] = await Promise.all([
    garantirLugares(sb, tenantId),
    valoresAtuais(sb, tenantId),
  ])
  const prontos = ORIGENS.filter((o) => valores[o.origem] !== null)
  ok(
    await sb.from('wealth_snapshot').upsert(
      prontos.map((o) => ({
        tenant_id: tenantId,
        place_id: ids[o.origem],
        mes,
        valor: centavos(valores[o.origem]!),
      })),
      { onConflict: 'place_id,mes' },
    ),
  )
  const copiados = await carregarManuais(sb, tenantId, mes)
  const pulados = ORIGENS.filter((o) => valores[o.origem] === null).map((o) => o.nome)
  if (pulados.length) console.warn(`[patrimonio] sem cotação, mantida a última foto: ${pulados.join(', ')}`)
  return { mes, copiados, pulados }
}
