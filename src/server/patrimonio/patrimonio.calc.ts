// Cálculos PUROS do patrimônio — rodam igual no back e no front.

export type Moeda = 'BRL' | 'USD' | 'EUR'

// Lugares AUTOMÁTICOS: o valor vem do módulo de investimento (não se digita).
export type Origem = 'acao' | 'fii' | 'renda_fixa' | 'cripto' | 'consorcio'

export const ORIGENS: { origem: Origem; nome: string; moeda: Moeda; href: string }[] = [
  { origem: 'acao', nome: 'Ações', moeda: 'BRL', href: '/acoes' },
  { origem: 'fii', nome: 'FIIs', moeda: 'BRL', href: '/fii' },
  { origem: 'renda_fixa', nome: 'Renda Fixa', moeda: 'BRL', href: '/renda-fixa' },
  { origem: 'cripto', nome: 'Cripto', moeda: 'USD', href: '/cripto' },
  // Consórcio: o que já foi PAGO das cotas em andamento/contempladas.
  { origem: 'consorcio', nome: 'Consórcios', moeda: 'BRL', href: '/consorcios' },
]

export type WealthPlace = {
  id: string
  name: string
  ordem: number
  moeda: Moeda
  /** null = manual; preenchido = automático (vem do módulo). */
  origem?: Origem | null
  /** 'AAAA-MM-DD': some da lista a partir desse mês (continua contando nos totais). */
  oculto_desde?: string | null
}

/** O bem aparece na lista do mês 'AAAA-MM-01'? (Oculto ou não, sempre conta.) */
export const visivelNoMes = (p: Pick<WealthPlace, 'oculto_desde'>, mes: string) =>
  !p.oculto_desde || mes < p.oculto_desde.slice(0, 10)

export const ehAutomatico = (p: Pick<WealthPlace, 'origem'>) => p.origem != null

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

/** 'AAAA-MM-01' do mês corrente no horário de Brasília (não UTC). */
export function mesAtualBR(agora = new Date()): string {
  const ym = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(agora) // '2026-11'
  return `${ym}-01`
}
