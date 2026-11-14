import { z } from 'zod'

// Define o valor de um lugar num mês (vira upsert: 1 foto por lugar/mês).
export const snapshotSetSchema = z.object({
  place_id: z.string().uuid(),
  // Sempre dia 01 (1 foto por mês) e mês válido.
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, 'Use o formato AAAA-MM-01'),
  valor: z.number().min(0),
})

export type SnapshotSet = z.infer<typeof snapshotSetSchema>
