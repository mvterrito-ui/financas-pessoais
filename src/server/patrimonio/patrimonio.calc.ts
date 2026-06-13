// Cálculos PUROS do patrimônio — rodam igual no back e no front.

export type Moeda = 'BRL' | 'USD' | 'EUR'

export type WealthPlace = {
  id: string
  name: string
  ordem: number
  moeda: Moeda
}

export type WealthSnapshot = {
  id: string
  place_id: string
  mes: string // 'AAAA-MM-DD' (dia 1º)
  valor: number | string
}

// Cotações em relação ao real (BRL sempre = 1).
export type Rates = { USD: number; EUR: number }

// Converte um valor da moeda nativa pra real.
export function emBRL(valor: number, moeda: Moeda, rates: Rates): number {
  if (moeda === 'USD') return valor * rates.USD
  if (moeda === 'EUR') return valor * rates.EUR
  return valor
}

// Soma por mês, JÁ convertido pra real (usa a moeda de cada lugar).
export function evolucaoBRL(
  snaps: WealthSnapshot[],
  moedaDoLugar: Record<string, Moeda>,
  rates: Rates,
): { mes: string; total: number }[] {
  const porMes = new Map<string, number>()
  for (const s of snaps) {
    const brl = emBRL(Number(s.valor), moedaDoLugar[s.place_id] ?? 'BRL', rates)
    porMes.set(s.mes, (porMes.get(s.mes) ?? 0) + brl)
  }
  return [...porMes.entries()]
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

// Variação percentual entre dois valores (ex: mês atual vs anterior).
export function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null
  return ((atual - anterior) / anterior) * 100
}
