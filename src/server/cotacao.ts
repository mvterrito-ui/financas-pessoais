// Cotações ao vivo usadas no servidor (sem token/conta).

// Preço atual de ativos da B3 (ações e FIIs) via Yahoo Finance.
// Tickers da B3 levam sufixo ".SA" no Yahoo (ex: BTLG11 -> BTLG11.SA).
// Retorna { BTLG11: 93.86, ... } — tickers sem cotação ficam de fora.
export async function precosB3(tickers: string[]): Promise<Record<string, number>> {
  const unicos = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))]

  async function precoDe(ticker: string): Promise<[string, number] | null> {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } },
      )
      const data = await res.json()
      const preco = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      return typeof preco === 'number' ? [ticker, preco] : null
    } catch {
      return null
    }
  }

  const precos: Record<string, number> = {}
  for (const r of await Promise.all(unicos.map(precoDe))) if (r) precos[r[0]] = r[1]
  return precos
}

export type AtivoB3 = {
  ticker: string // sem o ".SA"
  nome: string // nome completo da empresa/fundo
  descricao: string // nome curto do pregão (ex: "PETROBRAS PN N2")
  fii: boolean
  preco: number | null
}

// Ticker "normal" da B3: 4 letras + 1-2 dígitos (PETR4, HGLG11). Descarta
// variantes estranhas do Yahoo (ex: HGLG11Q = fracionário/recibo).
const TICKER_B3 = /^[A-Z]{4}\d{1,2}$/

/** Fundo imobiliário? (o Yahoo marca tudo como EQUITY; o nome entrega.) */
export const pareceFii = (nome: string, descricao: string) =>
  /^FII\b/i.test(descricao.trim()) || /imobili/i.test(nome)

/**
 * Busca ativos da B3 pelo começo do código ou nome (Yahoo Finance, sem token).
 * Devolve até 6, já com o preço atual — pro usuário confirmar que achou o certo.
 */
export async function buscarAtivosB3(termo: string): Promise<AtivoB3[]> {
  const q = termo.trim()
  if (q.length < 2) return []
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&lang=pt-BR&region=BR`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
    )
    const data = await res.json()
    const vistos = new Set<string>()
    const achados = ((data?.quotes ?? []) as Record<string, string>[])
      .filter((x) => x.exchange === 'SAO' && typeof x.symbol === 'string' && x.symbol.endsWith('.SA'))
      .map((x) => {
        const ticker = x.symbol.replace(/\.SA$/, '')
        const descricao = (x.shortname ?? '').replace(/\s+/g, ' ').trim()
        const nome = (x.longname ?? descricao ?? ticker).trim()
        return { ticker, nome, descricao, fii: pareceFii(nome, descricao) }
      })
      .filter((a) => TICKER_B3.test(a.ticker) && !vistos.has(a.ticker) && vistos.add(a.ticker))
      .slice(0, 6)
    const precos = await precosB3(achados.map((a) => a.ticker))
    return achados.map((a) => ({ ...a, preco: precos[a.ticker] ?? null }))
  } catch {
    return []
  }
}
