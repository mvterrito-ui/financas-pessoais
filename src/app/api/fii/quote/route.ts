import { withAuth } from '@/server/http'
import { precosB3 } from '@/server/cotacao'

// Cotação ao vivo de FIIs/ações via Yahoo Finance (SEM token/conta).
// Exige login (não é um proxy aberto pro Yahoo); no máx. 60 tickers válidos.
// GET /api/fii/quote?tickers=BTLG11,CVBI11  ->  { precos: { BTLG11: 93.86, ... } }
export function GET(request: Request) {
  const tickers = (new URL(request.url).searchParams.get('tickers') ?? '').split(',')
  return withAuth(async () => ({ precos: await precosB3(tickers) }))
}
