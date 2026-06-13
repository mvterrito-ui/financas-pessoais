import { z } from 'zod'

// Define o valor de um lugar num mês (vira upsert: 1 foto por lugar/mês).
export const snapshotSetSchema = z.object({
  place_id: z.string().uuid(),
  mes: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD'),
  valor: z.number().min(0),
})

export type SnapshotSet = z.infer<typeof snapshotSetSchema>
