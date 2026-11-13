// Cálculos PUROS do cripto — rodam igual no back e no front.

export type CryptoSummary = {
  id: string
  exchange: string
  ano: number
  aplicado: number | string
  resultado: number | string // lucro (+) ou prejuízo (-)
}

// Retorno percentual = resultado / aplicado * 100.
export function retornoPct(aplicado: number, resultado: number): number | null {
  if (!aplicado) return null
  return (resultado / aplicado) * 100
}

// Totais de um conjunto (ex: as corretoras de um ano).
export function totais(itens: CryptoSummary[]) {
  const aplicado = itens.reduce((s, x) => s + Number(x.aplicado), 0)
  const resultado = itens.reduce((s, x) => s + Number(x.resultado), 0)
  return { aplicado, resultado, retorno: retornoPct(aplicado, resultado) }
}

// Anos distintos presentes (pra montar o seletor).
export function anosDisponiveis(itens: CryptoSummary[]): number[] {
  return [...new Set(itens.map((i) => i.ano))].sort((a, b) => b - a)
}

// ---- Detalhamento de uma corretora ----------------------------------
export type CryptoItem = {
  id: string
  summary_id: string
  label: string
  valor: number | string
  ordem: number
}

export function somaItens(itens: CryptoItem[]): number {
  return itens.reduce((s, i) => s + Number(i.valor), 0)
}

// ---- Valor atual (pro Patrimônio) -------------------------------------
// Posição de hoje = aplicado + resultado das corretoras do ANO MAIS RECENTE
// com dados (em US$). Anos anteriores são histórico, não somam.
export function valorAtual(itens: CryptoSummary[]): number {
  if (itens.length === 0) return 0
  const ano = Math.max(...itens.map((i) => i.ano))
  const t = totais(itens.filter((i) => i.ano === ano))
  return t.aplicado + t.resultado
}
