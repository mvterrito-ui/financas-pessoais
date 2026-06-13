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
