import { z } from 'zod'
import { parcial } from '@/server/zod-util'

// Conta/carteira/método: Cartão XP, Pix, MEI, Bybit...
export const accountCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(80),
  tipo: z.enum(['conta', 'cartao', 'dinheiro', 'investimento']).default('conta'),
  moeda: z.enum(['BRL', 'USD', 'EUR', 'BTC']).default('BRL'),
  // Fatia do Orçamento que essa conta usa (as saídas dela contam ali).
  budget_id: z.string().uuid().nullable().optional(),
})

export const accountUpdateSchema = parcial(accountCreateSchema)

export type AccountCreate = z.infer<typeof accountCreateSchema>
export type AccountUpdate = z.infer<typeof accountUpdateSchema>
