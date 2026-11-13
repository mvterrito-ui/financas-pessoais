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
