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
// Posição de hoje (US$) = soma, POR CORRETORA, de aplicado + resultado do ano
// mais recente DAQUELA corretora. (Antes usava o ano mais alto geral: uma
// corretora que ainda não tinha linha no ano novo sumia do patrimônio.)
export function valorAtual(itens: CryptoSummary[]): number {
  const ultima = new Map<string, CryptoSummary>()
  for (const i of itens) {
    const atual = ultima.get(i.exchange)
    if (!atual || i.ano > atual.ano) ultima.set(i.exchange, i)
  }
  return [...ultima.values()].reduce((s, i) => s + Number(i.aplicado) + Number(i.resultado), 0)
}

// ---- Edição por "valor atual" ------------------------------------------
// No banco ficam aplicado + resultado; na tela o usuário digita o VALOR ATUAL
// e o lucro/prejuízo sai sozinho (resultado = atual − aplicado).
export const valorAtualLinha = (l: Pick<CryptoSummary, 'aplicado' | 'resultado'>) =>
  Number(l.aplicado) + Number(l.resultado)

/**
 * Novo { aplicado, resultado } ao editar um campo:
 *  - 'atual'    -> mantém o aplicado, recalcula o resultado;
 *  - 'aplicado' -> mantém o valor atual (o que a carteira vale hoje), recalcula o resultado.
 */
export function aoEditar(
  linha: Pick<CryptoSummary, 'aplicado' | 'resultado'> | undefined,
  campo: 'aplicado' | 'atual',
  valor: number,
): { aplicado: number; resultado: number } {
  const aplicado = Number(linha?.aplicado ?? 0)
  const atual = linha ? valorAtualLinha(linha) : 0
  if (campo === 'atual') return { aplicado, resultado: valor - aplicado }
  return { aplicado: valor, resultado: (linha ? atual : valor) - valor }
}
