// Regras das recorrências (receitas/despesas fixas). Funções puras.

export type Recorrencia = {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number | string
  moeda: 'BRL' | 'USD' | 'EUR'
  item_id: string | null
  account_id: string | null
  dia: number
  inicio: string // AAAA-MM-01
  fim: string | null // último mês (AAAA-MM-01), null = sem fim
}
export type Pausa = { id: string; recorrencia_id: string; de: string; ate: string | null }
export type AjusteValor = { id: string; recorrencia_id: string; a_partir: string; valor: number | string }
/** Lançamento confirmado a partir de uma recorrência. */
export type Confirmacao = { recorrencia_id: string | null; competencia: string | null }

export type Status = 'ativa' | 'pausada' | 'finalizada' | 'futura'

const ym = (d: string) => d.slice(0, 7)

export function proximoMes(m: string): string {
  const [a, mm] = m.split('-').map(Number)
  return mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, '0')}`
}

const ultimoDia = (m: string) => {
  const [a, mm] = m.split('-').map(Number)
  return new Date(Date.UTC(a, mm, 0)).getUTCDate()
}

/** Data do mês em que a recorrência cai (dia 31 em fevereiro -> último dia). */
export const dataNoMes = (r: Pick<Recorrencia, 'dia'>, mes: string) =>
  `${ym(mes)}-${String(Math.min(r.dia, ultimoDia(ym(mes)))).padStart(2, '0')}`

export const pausasDe = (r: Recorrencia, todas: Pausa[]) => todas.filter((p) => p.recorrencia_id === r.id)

/** A pausa que cobre aquele mês, se houver (pausa sem `ate` vale até ser retomada). */
export const pausaQueCobre = (r: Recorrencia, pausas: Pausa[], mes: string) =>
  pausasDe(r, pausas).find((p) => ym(p.de) <= ym(mes) && (!p.ate || ym(mes) <= ym(p.ate)))

/** Pausada naquele mês? */
export const pausadaEm = (r: Recorrencia, pausas: Pausa[], mes: string) => Boolean(pausaQueCobre(r, pausas, mes))

/** A recorrência acontece naquele mês (dentro do período e sem pausa)? */
export function aconteceEm(r: Recorrencia, pausas: Pausa[], mes: string): boolean {
  const m = ym(mes)
  if (m < ym(r.inicio)) return false
  if (r.fim && m > ym(r.fim)) return false
  return !pausadaEm(r, pausas, mes)
}

/** Valor que vale naquele mês: o último ajuste com a_partir ≤ mês, senão o inicial. */
export function valorNoMes(r: Recorrencia, ajustes: AjusteValor[], mes: string): number {
  let valor = Number(r.valor)
  const m = ym(mes)
  for (const a of ajustes
    .filter((x) => x.recorrencia_id === r.id)
    .sort((x, y) => x.a_partir.localeCompare(y.a_partir))) {
    if (ym(a.a_partir) <= m) valor = Number(a.valor)
  }
  return valor
}

/** Estado no mês de referência (normalmente o atual). */
export function statusEm(r: Recorrencia, pausas: Pausa[], mes: string): Status {
  const m = ym(mes)
  if (r.fim && m > ym(r.fim)) return 'finalizada'
  if (m < ym(r.inicio)) return 'futura'
  return pausadaEm(r, pausas, mes) ? 'pausada' : 'ativa'
}


export type Previsto = {
  recorrencia: Recorrencia
  mes: string // AAAA-MM-01
  data: string // AAAA-MM-DD
  valor: number
  confirmada: boolean
}

/**
 * Previsões de um mês: uma por recorrência que acontece nele. `confirmada`
 * quando já existe o lançamento (recorrencia_id + competencia).
 */
export function previstosDoMes(
  recs: Recorrencia[],
  pausas: Pausa[],
  ajustes: AjusteValor[],
  confirmacoes: Confirmacao[],
  mes: string,
): Previsto[] {
  const m = ym(mes)
  const feitas = new Set(
    confirmacoes.filter((c) => c.recorrencia_id && c.competencia).map((c) => `${c.recorrencia_id}|${ym(c.competencia!)}`),
  )
  return recs
    .filter((r) => aconteceEm(r, pausas, mes))
    .map((r) => ({
      recorrencia: r,
      mes: `${m}-01`,
      data: dataNoMes(r, mes),
      valor: valorNoMes(r, ajustes, mes),
      confirmada: feitas.has(`${r.id}|${m}`),
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * Planejado por categoria e mês num ano (pro Controle Anual): soma das
 * recorrências que acontecem em cada mês, no valor vigente.
 */
export function planejadoDoAno(
  recs: Recorrencia[],
  pausas: Pausa[],
  ajustes: AjusteValor[],
  ano: number,
): { item_id: string; mes: string; moeda: string; valor: number }[] {
  const out = new Map<string, { item_id: string; mes: string; moeda: string; valor: number }>()
  for (let i = 1; i <= 12; i++) {
    const mes = `${ano}-${String(i).padStart(2, '0')}-01`
    for (const r of recs) {
      if (!r.item_id || !aconteceEm(r, pausas, mes)) continue
      const k = `${r.item_id}|${mes}|${r.moeda}`
      const o = out.get(k) ?? { item_id: r.item_id, mes, moeda: r.moeda, valor: 0 }
      o.valor += valorNoMes(r, ajustes, mes)
      out.set(k, o)
    }
  }
  return [...out.values()]
}

/** Próximo mês (a partir de `mes`, inclusive) em que a recorrência acontece. */
export function proximaOcorrencia(r: Recorrencia, pausas: Pausa[], mes: string): string | null {
  let m = ym(mes) < ym(r.inicio) ? ym(r.inicio) : ym(mes)
  for (let i = 0; i < 120; i++, m = proximoMes(m)) {
    if (r.fim && m > ym(r.fim)) return null
    if (aconteceEm(r, pausas, `${m}-01`)) return dataNoMes(r, m)
  }
  return null
}
