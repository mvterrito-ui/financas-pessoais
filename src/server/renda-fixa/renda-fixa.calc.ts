// Cálculos PUROS da renda fixa — rodam igual no back e no front.

export type FixedIncome = {
  id: string
  nome: string
  instituicao: string | null
  tipo: string | null
  valor_aplicado: number | string
  valor_atual: number | string
  vencimento: string | null
}

export function rendimento(f: FixedIncome): number {
  return Number(f.valor_atual) - Number(f.valor_aplicado)
}

export function retornoPct(aplicado: number, resultado: number): number | null {
  if (!aplicado) return null
  return (resultado / aplicado) * 100
}

export function totais(itens: FixedIncome[]) {
  const aplicado = itens.reduce((s, f) => s + Number(f.valor_aplicado), 0)
  const atual = itens.reduce((s, f) => s + Number(f.valor_atual), 0)
  const resultado = atual - aplicado
  return { aplicado, atual, resultado, retorno: retornoPct(aplicado, resultado) }
}
