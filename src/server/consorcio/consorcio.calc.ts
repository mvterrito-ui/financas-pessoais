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

export const faltamParcelas = (c: Consorcio) => Math.max(0, c.prazo_meses - c.parcelas_pagas)

/** % quitado (0–100), pelo nº de parcelas. */
export const pctQuitado = (c: Consorcio) =>
  c.prazo_meses > 0 ? Math.min(100, (c.parcelas_pagas / c.prazo_meses) * 100) : 0

/** Estimativa pelo valor ATUAL da parcela (a parcela pode ter sido reajustada). */
export const pagoEstimado = (c: Consorcio) => c.parcelas_pagas * Number(c.valor_parcela)
export const faltaPagar = (c: Consorcio) =>
  c.status === 'encerrado' ? 0 : faltamParcelas(c) * Number(c.valor_parcela)

/** Ainda paga parcela todo mês? (encerrado ou quitado = não) */
export const emAndamento = (c: Consorcio) => c.status !== 'encerrado' && faltamParcelas(c) > 0

export function totais(lista: Consorcio[]) {
  const andamento = lista.filter(emAndamento)
  return {
    cartas: lista.filter((c) => c.status !== 'encerrado').reduce((s, c) => s + Number(c.valor_carta), 0),
    pago: lista.reduce((s, c) => s + pagoEstimado(c), 0),
    falta: lista.reduce((s, c) => s + faltaPagar(c), 0),
    parcelaMensal: andamento.reduce((s, c) => s + Number(c.valor_parcela), 0),
    emAndamento: andamento.length,
    contemplados: lista.filter((c) => c.status === 'contemplado').length,
  }
}
