import { z } from 'zod'

// Define (upsert) o resumo de uma corretora num ano.
export const cryptoSetSchema = z.object({
  exchange: z.string().trim().min(1, 'Informe a corretora').max(60),
  ano: z.number().int().min(2000).max(2100),
  aplicado: z.number().min(0).optional().default(0),
  resultado: z.number().optional().default(0), // pode ser negativo (prejuízo)
})

export type CryptoSet = z.infer<typeof cryptoSetSchema>
