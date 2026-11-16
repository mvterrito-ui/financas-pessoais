// Cálculos PUROS do fluxo de caixa (sem banco, sem rede).
// Por serem puros, rodam igual no back e no front -> dá pra mostrar
// preview no front sem pedir nada pro servidor.

export type Moeda = 'BRL' | 'USD' | 'EUR'

export type Transaction = {
  id: string
  tipo: 'entrada' | 'saida'
  valor: number | string // numeric do Postgres pode chegar como string (na moeda nativa)
  moeda?: Moeda // moeda do lançamento (default BRL)
  data: string
  descricao: string | null
  budget_id: string | null // fatia do Orçamento
  parcela_grupo: string | null // une as parcelas da mesma compra (null = à vista)
  parcela_num: number | null // qual parcela (1, 2, 3...)
  parcela_total: number | null // total de parcelas (ex: 12)
  /** Categoria do plano de contas. */
  item_id?: string | null
  /** Lançamento que confirmou uma recorrência (e de qual mês). */
  recorrencia_id?: string | null
  competencia?: string | null
}


// Cotações ao vivo em relação ao real (BRL sempre = 1).
export type Rates = { USD: number; EUR: number }

// Valor de um lançamento JÁ em real. Sem rates (ou moeda BRL) = valor cru.
// Com rates e moeda estrangeira = convertido pela cotação ao vivo.
export function valorEmBRL(
  valor: number | string,
  moeda?: Moeda | null,
  rates?: Rates,
): number {
  const v = Number(valor)
  if (!rates || !moeda || moeda === 'BRL') return v
  if (moeda === 'USD') return v * rates.USD
  if (moeda === 'EUR') return v * rates.EUR
  return v
}


export function totalEntradas(txs: Transaction[], rates?: Rates): number {
  return txs
    .filter((t) => t.tipo === 'entrada')
    .reduce((soma, t) => soma + valorEmBRL(t.valor, t.moeda, rates), 0)
}

export function totalSaidas(txs: Transaction[], rates?: Rates): number {
  return txs
    .filter((t) => t.tipo === 'saida')
    .reduce((soma, t) => soma + valorEmBRL(t.valor, t.moeda, rates), 0)
}

export function saldo(txs: Transaction[], rates?: Rates): number {
  return totalEntradas(txs, rates) - totalSaidas(txs, rates)
}

export type CategoriaResumo = {
  id: string | null
  name: string
  total: number
  pct: number // fatia do total daquele tipo (0-100)
}

// Agrupa os lançamentos de um tipo (entrada/saida) pela chave escolhida
// (categoria do plano, por padrão), com o total e a fatia (%) de cada uma.
// Ordena do maior pro menor. Sem chave cai em `rotuloVazio`.
export function porCategoria(
  txs: Transaction[],
  categories: { id: string; name: string }[],
  tipo: 'entrada' | 'saida',
  rates?: Rates,
  chave: (t: Transaction) => string | null = (t) => t.item_id ?? null,
  rotuloVazio = 'Sem categoria',
): CategoriaResumo[] {
  const doTipo = txs.filter((t) => t.tipo === tipo)
  const total = doTipo.reduce((s, t) => s + valorEmBRL(t.valor, t.moeda, rates), 0)
  const nome = new Map(categories.map((c) => [c.id, c.name]))

  const porId = new Map<string | null, number>()
  for (const t of doTipo) {
    const k = chave(t)
    porId.set(k, (porId.get(k) ?? 0) + valorEmBRL(t.valor, t.moeda, rates))
  }

  return [...porId.entries()]
    .map(([id, soma]) => ({
      id,
      name: id ? (nome.get(id) ?? rotuloVazio) : rotuloVazio,
      total: soma,
      pct: total > 0 ? (soma / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Formata na moeda nativa do lançamento (R$, US$ ou €).
export function formatMoeda(v: number, moeda: Moeda = 'BRL'): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: moeda })
}

// ---- Parcelamento -----------------------------------------------------

// Avança 'n' meses numa data ISO, sem estourar o dia. Ex: 31/01 + 1 mês
// não vira 03/03 — cai pro último dia do mês (28/02), como num cartão.
export function addMeses(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const alvo = new Date(a, m - 1 + n, 1)
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  const dia = Math.min(d, ultimoDia)
  const yy = alvo.getFullYear()
  const mm = String(alvo.getMonth() + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export type ParcelaGerada = { num: number; data: string; valor: number }

// Divide um total em 'n' parcelas mensais. Trabalha em CENTAVOS (inteiros)
// pra não acumular erro de float; a sobra de centavos vai na última parcela.
// Ex: 100 em 3x -> 33,33 / 33,33 / 33,34 (soma exata = 100,00).
export function gerarParcelas(total: number, n: number, dataPrimeira: string): ParcelaGerada[] {
  const totalCents = Math.round(total * 100)
  const baseCents = Math.floor(totalCents / n)
  const parcelas: ParcelaGerada[] = []
  for (let i = 0; i < n; i++) {
    const cents = i === n - 1 ? totalCents - baseCents * (n - 1) : baseCents
    parcelas.push({ num: i + 1, data: addMeses(dataPrimeira, i), valor: cents / 100 })
  }
  return parcelas
}
