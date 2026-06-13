// Cálculos PUROS dos FIIs — rodam igual no back e no front.

export type Fii = {
  id: string
  ticker: string
  quantidade: number | string
  preco_medio: number | string
}

// ticker -> preço atual (R$), vindo da cotação ao vivo.
export type Quotes = Record<string, number>

export function investido(f: Fii): number {
  return Number(f.quantidade) * Number(f.preco_medio)
}

// Valor atual usa o preço ao vivo; se não houver cotação, cai pro investido.
export function valorAtual(f: Fii, quotes: Quotes): number {
  const p = quotes[f.ticker]
  return p == null ? investido(f) : Number(f.quantidade) * p
}

export function lucro(f: Fii, quotes: Quotes): number {
  return valorAtual(f, quotes) - investido(f)
}

export function retornoPct(aplicado: number, resultado: number): number | null {
  if (!aplicado) return null
  return (resultado / aplicado) * 100
}

export function totais(fiis: Fii[], quotes: Quotes) {
  const aplicado = fiis.reduce((s, f) => s + investido(f), 0)
  const atual = fiis.reduce((s, f) => s + valorAtual(f, quotes), 0)
  const resultado = atual - aplicado
  return { aplicado, atual, resultado, retorno: retornoPct(aplicado, resultado) }
}
