// Cálculos PUROS do Controle Anual — rodam igual no back e no front.

export type TipoGrupo = 'receita' | 'investimento' | 'despesa'

export type Grupo = {
  id: string
  name: string
  tipo: TipoGrupo
  descricao: string | null
  ordem: number
}
export type Categoria = { id: string; group_id: string; name: string; ordem: number }
export type Item = {
  id: string
  group_id: string
  category_id: string | null
  name: string
  ordem: number
  oculto: boolean
}
export type ValorMes = { item_id: string; mes: string; valor: number | string }

/** Valores indexados por "itemId|AAAA-MM-01". Mês vazio = chave ausente. */
export type Valores = Map<string, number>

/** Mês vazio = undefined (diferente de 0). */
export type Serie = (number | undefined)[]

export const chave = (itemId: string, mes: string) => `${itemId}|${mes.slice(0, 10)}`

export function indexar(linhas: ValorMes[]): Valores {
  return new Map(linhas.map((l) => [chave(l.item_id, l.mes), Number(l.valor)]))
}

/** ['AAAA-01-01', …, 'AAAA-12-01'] */
export function mesesDoAno(ano: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}-01`)
}

export function serieDoItem(itemId: string, meses: string[], valores: Valores): Serie {
  return meses.map((m) => valores.get(chave(itemId, m)))
}

/** Soma várias séries mês a mês; mês sem nenhum valor continua vazio. */
export function somarSeries(series: Serie[], tamanho = 12): Serie {
  return Array.from({ length: tamanho }, (_, i) => {
    const vals = series.map((s) => s[i]).filter((v): v is number => v !== undefined)
    return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined
  })
}

export const total = (s: Serie) => s.reduce<number>((a, v) => a + (v ?? 0), 0)

/** Média dos meses PREENCHIDOS (como o MÉDIA da planilha, que ignora vazios). */
export function media(s: Serie): number | null {
  const vals = s.filter((v): v is number => v !== undefined)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

export function pctDaReceita(valor: number | undefined, receita: number | undefined): number | null {
  if (valor === undefined || !receita) return null
  return (valor / receita) * 100
}

/** Item oculto só aparece no ano em que tem algum valor (preserva o histórico). */
export function itemVisivel(item: Pick<Item, 'oculto'>, serie: Serie): boolean {
  return !item.oculto || serie.some((v) => v !== undefined)
}

/**
 * "Repetir nos meses seguintes": cada mês VAZIO depois de um preenchido
 * recebe o último valor visto. Devolve só o que precisa gravar.
 */
export function preencherAdiante(s: Serie): { indice: number; valor: number }[] {
  const out: { indice: number; valor: number }[] = []
  let ultimo: number | undefined
  s.forEach((v, i) => {
    if (v !== undefined) ultimo = v
    else if (ultimo !== undefined) out.push({ indice: i, valor: ultimo })
  })
  return out
}

/** Totais do ano: por grupo, por tipo e o saldo (receita − investimento − despesa). */
export function resumo(grupos: Grupo[], itens: Item[], valores: Valores, ano: number) {
  const meses = mesesDoAno(ano)
  const porGrupo = new Map<string, Serie>()
  for (const g of grupos) {
    const series = itens.filter((i) => i.group_id === g.id).map((i) => serieDoItem(i.id, meses, valores))
    porGrupo.set(g.id, somarSeries(series))
  }
  const doTipo = (t: TipoGrupo) =>
    somarSeries(grupos.filter((g) => g.tipo === t).map((g) => porGrupo.get(g.id)!))
  const receita = doTipo('receita')
  const investimento = doTipo('investimento')
  const despesa = doTipo('despesa')
  const saldo: Serie = meses.map((_, i) =>
    receita[i] === undefined && investimento[i] === undefined && despesa[i] === undefined
      ? undefined
      : (receita[i] ?? 0) - (investimento[i] ?? 0) - (despesa[i] ?? 0),
  )
  return { meses, porGrupo, receita, investimento, despesa, saldo }
}

// ---- Ligação com o Fluxo de Caixa ---------------------------------------
export type FluxoDoItem = { item_id: string; mes: string; moeda: string; valor: number | string }

/**
 * Valores EFETIVOS da grade: item ligado ao Fluxo usa SÓ a soma dos
 * lançamentos (convertida pra real); o valor digitado nele fica guardado, mas
 * não conta enquanto estiver ligado. Itens não ligados ficam como estão.
 */
export function aplicarFluxo(
  valores: Valores,
  fluxo: FluxoDoItem[],
  ligados: Set<string>,
  emReal: (valor: number, moeda: string) => number,
): Valores {
  const out = new Map<string, number>()
  for (const [k, v] of valores) if (!ligados.has(k.split('|')[0])) out.set(k, v)
  for (const f of fluxo) {
    if (!ligados.has(f.item_id)) continue
    const k = chave(f.item_id, f.mes)
    out.set(k, (out.get(k) ?? 0) + emReal(Number(f.valor), f.moeda))
  }
  return out
}
