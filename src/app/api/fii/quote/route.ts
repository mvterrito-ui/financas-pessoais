import { NextResponse } from 'next/server'
import { precosB3 } from '@/server/cotacao'

// Proxy pra cotação ao vivo de FIIs/ações via Yahoo Finance (SEM token/conta).
// Buscamos no servidor, então não há problema de CORS.
// GET /api/fii/quote?tickers=BTLG11,CVBI11  ->  { precos: { BTLG11: 93.86, ... } }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tickers = (searchParams.get('tickers') ?? '').split(',')
  return NextResponse.json({ precos: await precosB3(tickers) })
}
