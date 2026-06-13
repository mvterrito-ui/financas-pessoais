import { NextResponse } from 'next/server'

// Proxy pra cotação ao vivo de FIIs via Yahoo Finance (SEM token/conta).
// Tickers da B3 levam sufixo ".SA" no Yahoo (ex: BTLG11 -> BTLG11.SA).
// Buscamos no servidor, então não há problema de CORS.
// GET /api/fii/quote?tickers=BTLG11,CVBI11  ->  { precos: { BTLG11: 93.86, ... } }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tickers = (searchParams.get('tickers') ?? '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
  if (tickers.length === 0) return NextResponse.json({ precos: {} })

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

  const resultados = await Promise.all(tickers.map(precoDe))
  const precos: Record<string, number> = {}
  for (const r of resultados) if (r) precos[r[0]] = r[1]

  return NextResponse.json({ precos })
}
