// Cálculos puros do orçamento (sem banco, sem rede): rodam igual no back e
// no front (preview ao vivo enquanto você edita os %).

export type BudgetBucket = {
  id: string
  name: string
  percentual: number | string // numeric do Postgres pode vir como string
  ordem: number
}

export type Alocacao = BudgetBucket & { valor: number }

// Quanto vai pra cada fatia, dadas as entradas do mês.
export function alocar(renda: number, buckets: BudgetBucket[]): Alocacao[] {
  return buckets.map((b) => ({
    ...b,
    valor: (renda * Number(b.percentual)) / 100,
  }))
}

// Soma dos percentuais (deve dar 100). Serve pra avisar se passou/faltou.
export function somaPercentual(buckets: BudgetBucket[]): number {
  return buckets.reduce((s, b) => s + Number(b.percentual), 0)
}

/**
 * Uso de cada fatia: soma das saídas lançadas nas contas ligadas a ela.
 * `emReal` converte o valor do lançamento pra real. Saída sem conta, ou numa
 * conta sem fatia, vai pra `semFatia`.
 */
export function usoPorFatia(
  saidas: { valor: number | string; moeda?: string | null; account_id?: string | null }[],
  contas: { id: string; budget_id?: string | null }[],
  emReal: (valor: number | string, moeda?: string | null) => number,
) {
  const fatiaDaConta = new Map(contas.map((c) => [c.id, c.budget_id ?? null]))
  const porFatia = new Map<string, number>()
  let semFatia = 0
  for (const s of saidas) {
    const fatia = s.account_id ? fatiaDaConta.get(s.account_id) : null
    const v = emReal(s.valor, s.moeda)
    if (fatia) porFatia.set(fatia, (porFatia.get(fatia) ?? 0) + v)
    else semFatia += v
  }
  return { porFatia, semFatia }
}
