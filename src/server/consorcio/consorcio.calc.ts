// Cálculos PUROS dos consórcios — rodam igual no back e no front.

export type TipoConsorcio = 'imovel' | 'veiculo' | 'servico' | 'outro'
export type StatusConsorcio = 'ativo' | 'contemplado' | 'encerrado'

export type Consorcio = {
  id: string
  nome: string
  administradora: string | null
  tipo: TipoConsorcio
  valor_carta: number | string
  prazo_meses: number
  parcelas_pagas: number
  valor_parcela: number | string
  status: StatusConsorcio
}

/** "A partir da parcela nº X, o valor passa a ser Y" (reajuste anual etc.). */
export type Reajuste = {
  id: string
  consorcio_id: string
  a_partir_parcela: number
  valor_parcela: number | string
}

export const faltamParcelas = (c: Consorcio) => Math.max(0, c.prazo_meses - c.parcelas_pagas)

/** Reajustes DESTE consórcio, em ordem de parcela. */
export const reajustesDe = (c: Consorcio, todos: Reajuste[]) =>
  todos.filter((r) => r.consorcio_id === c.id).sort((a, b) => a.a_partir_parcela - b.a_partir_parcela)

/**
 * Valor da parcela nº n: o do último reajuste que já vale (a_partir ≤ n);
 * antes de qualquer reajuste, o valor base do consórcio.
 */
export function valorDaParcela(c: Consorcio, reajustes: Reajuste[], n: number): number {
  let valor = Number(c.valor_parcela)
  for (const r of reajustesDe(c, reajustes)) {
    if (r.a_partir_parcela <= n) valor = Number(r.valor_parcela)
    else break
  }
  return valor
}

/** Parcela que vale AGORA (a próxima a pagar; se quitado, a última). */
export const parcelaAtual = (c: Consorcio, reajustes: Reajuste[] = []) =>
  valorDaParcela(c, reajustes, Math.min(c.parcelas_pagas + 1, c.prazo_meses))

const somaParcelas = (c: Consorcio, reajustes: Reajuste[], de: number, ate: number) => {
  let total = 0
  for (let n = de; n <= ate; n++) total += valorDaParcela(c, reajustes, n)
  return total
}

/** % quitado (0–100), pelo nº de parcelas. */
export const pctQuitado = (c: Consorcio) =>
  c.prazo_meses > 0 ? Math.min(100, (c.parcelas_pagas / c.prazo_meses) * 100) : 0

/** Já pago: cada parcela pelo valor que valia na época (considera os reajustes). */
export const pagoEstimado = (c: Consorcio, reajustes: Reajuste[] = []) =>
  somaParcelas(c, reajustes, 1, c.parcelas_pagas)

/** Falta pagar: parcelas restantes pelo valor vigente (e reajustes futuros já lançados). */
export const faltaPagar = (c: Consorcio, reajustes: Reajuste[] = []) =>
  c.status === 'encerrado' ? 0 : somaParcelas(c, reajustes, c.parcelas_pagas + 1, c.prazo_meses)

/** Faixas pra exibir o histórico: "1ª–12ª: R$ 850 · 13ª em diante: R$ 905 (+6,5%)". */
export function faixasDeParcela(c: Consorcio, reajustes: Reajuste[]) {
  const lista = reajustesDe(c, reajustes).filter((r) => r.a_partir_parcela > 1)
  const pontos = [
    { reajuste: null as Reajuste | null, de: 1, valor: valorDaParcela(c, reajustes, 1) },
    ...lista.map((r) => ({ reajuste: r, de: r.a_partir_parcela, valor: Number(r.valor_parcela) })),
  ]
  return pontos.map((p, i) => {
    const anterior = i > 0 ? pontos[i - 1].valor : null
    return {
      ...p,
      ate: i < pontos.length - 1 ? pontos[i + 1].de - 1 : null, // null = "em diante"
      variacaoPct: anterior ? ((p.valor - anterior) / anterior) * 100 : null,
    }
  })
}

/** Ainda paga parcela todo mês? (encerrado ou quitado = não) */
export const emAndamento = (c: Consorcio) => c.status !== 'encerrado' && faltamParcelas(c) > 0

export function totais(lista: Consorcio[], reajustes: Reajuste[] = []) {
  const andamento = lista.filter(emAndamento)
  return {
    cartas: lista.filter((c) => c.status !== 'encerrado').reduce((s, c) => s + Number(c.valor_carta), 0),
    pago: lista.reduce((s, c) => s + pagoEstimado(c, reajustes), 0),
    falta: lista.reduce((s, c) => s + faltaPagar(c, reajustes), 0),
    parcelaMensal: andamento.reduce((s, c) => s + parcelaAtual(c, reajustes), 0),
    emAndamento: andamento.length,
    contemplados: lista.filter((c) => c.status === 'contemplado').length,
  }
}
