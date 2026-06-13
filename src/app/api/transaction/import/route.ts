import { withAuth } from '@/server/http'
import { transactionService } from '@/server/fluxo/transaction.service'

// POST /api/transaction/import  -> grava os itens parseados de uma fatura.
export function POST(request: Request) {
  return withAuth(async (ctx) => transactionService.importStatement(ctx, await request.json()))
}
