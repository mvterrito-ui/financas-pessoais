// Cálculos puros dos Relatórios (sem banco, sem rede).

export type Lanc = {
  tipo: 'entrada' | 'saida'
  valor: number | string
  moeda?: string | null
  data: string // AAAA-MM-DD
  item_id?: string | null
}
export type EmReal = (valor: number | string, moeda?: string | null) => number

const mesDe = (data: string) => Number(data.slice(5, 7)) - 1

/** Entradas, saídas e saldo de cada mês (índice 0 = janeiro). */
export function porMes(txs: Lanc[], emReal: EmReal) {
  const meses = Array.from({ length: 12 }, () => ({ entradas: 0, saidas: 0, saldo: 0 }))
  for (const t of txs) {
    const m = meses[mesDe(t.data)]
    if (!m) continue
    const v = emReal(t.valor, t.moeda)
    if (t.tipo === 'entrada') m.entradas += v
    else m.saidas += v
  }
  for (const m of meses) m.saldo = m.entradas - m.saidas
  return meses
}

export const SEM_GRUPO = 'sem-grupo'
export const OUTROS = 'outros'

/**
 * Saídas por grupo do plano, mês a mês. Os `max` grupos que mais gastaram no
 * ano ficam separados; o resto (e o que não tem categoria, se não estiver
 * entre os maiores) vira "Outros". A ordem vem do total do ANO, então a cor de
 * cada grupo não muda quando o usuário escolhe um mês.
 */
export function saidasPorGrupoMes(
  txs: Lanc[],
  grupoDoItem: Map<string, string>,
  emReal: EmReal,
  max = 5,
) {
  const porGrupo = new Map<string, number[]>()
  for (const t of txs) {
    if (t.tipo !== 'saida') continue
    const g = (t.item_id && grupoDoItem.get(t.item_id)) || SEM_GRUPO
    const serie = porGrupo.get(g) ?? Array(12).fill(0)
    const m = mesDe(t.data)
    if (m >= 0 && m < 12) serie[m] += emReal(t.valor, t.moeda)
    porGrupo.set(g, serie)
  }
  const soma = (s: number[]) => s.reduce((a, b) => a + b, 0)
  const ordenados = [...porGrupo.entries()].sort((a, b) => soma(b[1]) - soma(a[1]))
  const principais = ordenados.slice(0, max).map(([id, serie]) => ({ id, serie, total: soma(serie) }))
  const resto = ordenados.slice(max)
  if (resto.length) {
    const serie = Array(12).fill(0)
    for (const [, s] of resto) s.forEach((v, i) => (serie[i] += v))
    principais.push({ id: OUTROS, serie, total: soma(serie) })
  }
  return principais
}

/** Valor "redondo" pro topo do eixo (1; 1,5; 2; 2,5; 3; 4; 5; 6 ou 8 × 10^n), sempre >= max. */
export function topoDoEixo(max: number): number {
  if (!(max > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(max))
  for (const f of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * p >= max) return f * p
  return 10 * p
}
