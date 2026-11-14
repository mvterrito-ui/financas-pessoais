// Cálculos PUROS da projeção de patrimônio — rodam igual no back e no front.
// Ideia: "se eu aportar R$ X por mês, a Y% ao mês, no que vira?"
// A taxa é MENSAL e definida pelo usuário; o histórico só sugere um valor.

export type PontoSerie = { mes: string; total: number }

// Quantos meses separam duas datas ISO ('AAAA-MM-DD'). Conta só ano+mês.
// Ex: 2025-01 -> 2026-03 = 14 meses.
export function mesesEntre(de: string, ate: string): number {
  const [ya, ma] = de.split('-').map(Number)
  const [yb, mb] = ate.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

// Taxa de rendimento MENSAL média do histórico (juros compostos do 1º ao último
// ponto). Retorna null quando não dá pra calcular (menos de 2 pontos, início/fim
// <= 0). Ex: 1.000 -> 1.268 em 24 meses -> ~1% ao mês.
export function taxaMensalHistorica(serie: PontoSerie[]): number | null {
  if (serie.length < 2) return null
  const a = serie[0]
  const b = serie[serie.length - 1]
  const meses = mesesEntre(a.mes, b.mes)
  if (meses <= 0 || a.total <= 0 || b.total <= 0) return null
  return Math.pow(b.total / a.total, 1 / meses) - 1
}

/**
 * Taxa mensal "igual com igual": em cada par de meses consecutivos, compara só
 * os lugares que têm valor NOS DOIS meses. Assim cadastrar um bem novo (ou
 * começar a preencher um que já existia) não conta como rendimento — o
 * primeiro×último inflava a taxa pra valores absurdos nesses casos.
 * (Aportes feitos num lugar existente ainda entram: é crescimento real dele.)
 */
export function taxaMensalComparavel(
  pontos: { mes: string; place_id: string; valor: number }[],
): number | null {
  const porMes = new Map<string, Map<string, number>>()
  for (const p of pontos) {
    const mes = p.mes.slice(0, 10)
    const m = porMes.get(mes) ?? new Map<string, number>()
    m.set(p.place_id, (m.get(p.place_id) ?? 0) + p.valor)
    porMes.set(mes, m)
  }
  const meses = [...porMes.keys()].sort()
  let fator = 1
  let totalMeses = 0
  for (let i = 1; i < meses.length; i++) {
    const a = porMes.get(meses[i - 1])!
    const b = porMes.get(meses[i])!
    const comuns = [...a.keys()].filter((id) => b.has(id) && a.get(id)! > 0)
    const sa = comuns.reduce((s, id) => s + a.get(id)!, 0)
    const sb = comuns.reduce((s, id) => s + b.get(id)!, 0)
    if (sa <= 0) continue
    fator *= sb / sa
    totalMeses += mesesEntre(meses[i - 1], meses[i])
  }
  if (totalMeses <= 0 || fator <= 0) return null
  return Math.pow(fator, 1 / totalMeses) - 1
}

// Converte taxa mensal -> equivalente anual (só pra exibir "≈ Y% ao ano").
export function mensalParaAnual(taxaMensal: number): number {
  return Math.pow(1 + taxaMensal, 12) - 1
}

export type PontoProjecao = {
  ano: number // 0 = hoje, 1 = daqui 1 ano...
  valor: number // projeção cheia (rendimento + aportes)
  semAporte: number // só o rendimento do que já tem (pra comparar)
  aportado: number // quanto foi colocado de aporte até aqui
}

// Projeta 'anos' à frente, mês a mês: cada mês rende a taxa MENSAL e recebe o
// aporte fixo. taxaMensal e aporteMensal vêm direto do usuário.
export function projetar(
  valorInicial: number,
  taxaMensal: number,
  aporteMensal: number,
  anos: number,
): PontoProjecao[] {
  const pontos: PontoProjecao[] = [
    { ano: 0, valor: valorInicial, semAporte: valorInicial, aportado: 0 },
  ]
  let valor = valorInicial
  let semAporte = valorInicial
  let aportado = 0
  for (let m = 1; m <= anos * 12; m++) {
    valor = valor * (1 + taxaMensal) + aporteMensal
    semAporte = semAporte * (1 + taxaMensal)
    aportado += aporteMensal
    if (m % 12 === 0) pontos.push({ ano: m / 12, valor, semAporte, aportado })
  }
  return pontos
}
