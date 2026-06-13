// Cálculos PUROS do orçamento (sem banco, sem rede) — rodam igual no
// back e no front (preview ao vivo enquanto você edita os %).

export type BudgetBucket = {
  id: string
  name: string
  percentual: number | string // numeric do Postgres pode vir como string
  ordem: number
}

export type Alocacao = BudgetBucket & { valor: number }

// Quanto vai pra cada balde, dada a renda do mês.
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
