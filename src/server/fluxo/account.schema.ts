import { z } from 'zod'

// Conta/carteira/método: Cartão XP, Pix, MEI, Bybit...
export const accountCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(80),
  tipo: z.enum(['conta', 'cartao', 'dinheiro', 'investimento']).default('conta'),
  moeda: z.enum(['BRL', 'USD', 'EUR', 'BTC']).default('BRL'),
})

export const accountUpdateSchema = accountCreateSchema.partial()

export type AccountCreate = z.infer<typeof accountCreateSchema>
export type AccountUpdate = z.infer<typeof accountUpdateSchema>
